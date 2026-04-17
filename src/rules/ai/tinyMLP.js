// src/rules/ai/tinyMLP.js
// Tiny feedforward neural network for monster AI policy.
// Pure forward-pass only; training lives in tools/trainAI.js.
//
// Architecture: inSize → h1Size → h2Size → outSize
//   Hidden layers: ReLU activation
//   Output layer:  softmax (action probabilities)
//
// Default shape:  20 → 24 → 16 → 14  (1142 scalar params total)

export const FEATURE_DIM = 20;
export const H1_SIZE     = 24;
export const H2_SIZE     = 16;
export const OUT_SIZE    = 14;

// ── Xavier uniform initialiser (seeded LCG so weights are deterministic) ─────
function xavierFill(size, fanIn, fanOut, seed) {
  const limit = Math.sqrt(6 / (fanIn + fanOut));
  const arr   = new Float64Array(size);
  let s = (seed >>> 0) || 0xDEADBEEF;
  for (let i = 0; i < size; i++) {
    s = Math.imul(s, 1664525) + 1013904223 >>> 0;
    arr[i] = ((s / 0xFFFFFFFF) * 2 - 1) * limit;
  }
  return arr;
}

// ── Network creation ──────────────────────────────────────────────────────────

/**
 * Create a network with Xavier-initialised weights (reproducible, seed-based).
 * Providing `inSize / h1Size / h2Size / outSize` overrides the defaults.
 * @param {number} [inSize]
 * @param {number} [h1Size]
 * @param {number} [h2Size]
 * @param {number} [outSize]
 * @returns {{ inSize:number, h1Size:number, h2Size:number, outSize:number, w1:Float64Array, b1:Float64Array, w2:Float64Array, b2:Float64Array, w3:Float64Array, b3:Float64Array }}
 */
export function createMLP(inSize = FEATURE_DIM, h1Size = H1_SIZE, h2Size = H2_SIZE, outSize = OUT_SIZE) {
  return {
    inSize, h1Size, h2Size, outSize,
    w1: xavierFill(h1Size * inSize, inSize,  h1Size, 0xA1B2C3D4),
    b1: new Float64Array(h1Size),
    w2: xavierFill(h2Size * h1Size, h1Size,  h2Size, 0xD4C3B2A1),
    b2: new Float64Array(h2Size),
    w3: xavierFill(outSize * h2Size, h2Size, outSize, 0xFEEDFACE),
    b3: new Float64Array(outSize),
  };
}

// ── Math helpers ──────────────────────────────────────────────────────────────

/** Numerically-stable softmax (mutates input array, returns it). */
function softmaxInPlace(x) {
  let max = x[0];
  for (let i = 1; i < x.length; i++) if (x[i] > max) max = x[i];
  let sum = 0;
  for (let i = 0; i < x.length; i++) { x[i] = Math.exp(x[i] - max); sum += x[i]; }
  for (let i = 0; i < x.length; i++) x[i] /= sum;
  return x;
}

/** Dense layer: out[r] = relu(Σ W[r,c]*in[c] + b[r]) */
function denseRelu(W, x, b, rows, cols, out) {
  for (let r = 0; r < rows; r++) {
    let sum = b[r];
    const base = r * cols;
    for (let c = 0; c < cols; c++) sum += W[base + c] * x[c];
    out[r] = sum > 0 ? sum : 0;
  }
}

/** Dense layer without activation (final layer before softmax). */
function denseLinear(W, x, b, rows, cols, out) {
  for (let r = 0; r < rows; r++) {
    let sum = b[r];
    const base = r * cols;
    for (let c = 0; c < cols; c++) sum += W[base + c] * x[c];
    out[r] = sum;
  }
}

// ── Forward pass ──────────────────────────────────────────────────────────────

// Pre-allocate scratch buffers per call (re-used across calls via module-level cache).
/** @type {WeakMap<object, { h1:Float64Array, h2:Float64Array, out:Float64Array }>} */
const _scratch = new WeakMap();

function ensureScratch(net) {
  let s = _scratch.get(net);
  if (!s) {
    s = {
      h1:  new Float64Array(net.h1Size),
      h2:  new Float64Array(net.h2Size),
      out: new Float64Array(net.outSize),
    };
    _scratch.set(net, s);
  }
  return s;
}

/**
 * Forward pass → softmax probabilities.
 * Returns an internal scratch buffer — copy if you need persistence across calls.
 * @param {ReturnType<typeof createMLP>} net
 * @param {Float64Array} input  length must equal net.inSize
 * @returns {Float64Array}  length net.outSize (softmax probabilities)
 */
export function forward(net, input) {
  const { h1, h2, out } = ensureScratch(net);
  denseRelu  (net.w1, input, net.b1, net.h1Size, net.inSize,  h1);
  denseRelu  (net.w2, h1,    net.b2, net.h2Size, net.h1Size,  h2);
  denseLinear(net.w3, h2,    net.b3, net.outSize, net.h2Size, out);
  softmaxInPlace(out);
  return out;
}

/**
 * Argmax of the output array from forward().
 * @param {Float64Array} probs
 * @returns {number}
 */
export function argmax(probs) {
  let best = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[best]) best = i;
  return best;
}

// ── Weight serialisation ──────────────────────────────────────────────────────

/** Total scalar count for this architecture. */
export function totalWeightCount(inSize = FEATURE_DIM, h1Size = H1_SIZE, h2Size = H2_SIZE, outSize = OUT_SIZE) {
  return (h1Size * inSize + h1Size) + (h2Size * h1Size + h2Size) + (outSize * h2Size + outSize);
}

/**
 * Flatten all weights+biases into one Float64Array.
 * Order: w1, b1, w2, b2, w3, b3
 * @param {ReturnType<typeof createMLP>} net
 * @returns {Float64Array}
 */
export function getWeights(net) {
  const total = totalWeightCount(net.inSize, net.h1Size, net.h2Size, net.outSize);
  const out = new Float64Array(total);
  let i = 0;
  for (const arr of [net.w1, net.b1, net.w2, net.b2, net.w3, net.b3]) {
    out.set(arr, i); i += arr.length;
  }
  return out;
}

/**
 * Load a flat weight array back into a network (mutates in-place).
 * @param {ReturnType<typeof createMLP>} net
 * @param {Float64Array | number[]} weights
 */
export function setWeights(net, weights) {
  const w = weights instanceof Float64Array ? weights : Float64Array.from(weights);
  let i = 0;
  for (const arr of [net.w1, net.b1, net.w2, net.b2, net.w3, net.b3]) {
    arr.set(w.subarray(i, i + arr.length)); i += arr.length;
  }
}

/**
 * Serialise to a plain object suitable for JSON or embedding in aiWeights.js.
 * @param {ReturnType<typeof createMLP>} net
 * @returns {{ inSize:number, h1Size:number, h2Size:number, outSize:number, weights:number[] }}
 */
export function serializeNet(net) {
  return {
    inSize:  net.inSize,
    h1Size:  net.h1Size,
    h2Size:  net.h2Size,
    outSize: net.outSize,
    weights: Array.from(getWeights(net)),
  };
}

/**
 * Restore a network from a serialised object.
 * @param {{ inSize:number, h1Size:number, h2Size:number, outSize:number, weights:number[] }} obj
 * @returns {ReturnType<typeof createMLP>}
 */
export function deserializeNet(obj) {
  const net = createMLP(obj.inSize, obj.h1Size, obj.h2Size, obj.outSize);
  setWeights(net, obj.weights);
  return net;
}
