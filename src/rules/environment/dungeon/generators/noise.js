// rules/environment/dungeon/generators/noise.js
// Seeded Perlin / fBM noise utilities extracted from overworld.js.
// Exported so both overworld and dungeon generators share one implementation.

import { createRng } from '../../../../lib/ecs-js/rng.js';

const TILE_WALL  = 2;
const TILE_FLOOR = 1;

// --- core Perlin helpers ---

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + t * (b - a); }

function grad(hash, x, y) {
  const h = hash & 7;
  switch (h) {
    case 0: return  x + y;
    case 1: return -x + y;
    case 2: return  x - y;
    case 3: return -x - y;
    case 4: return  x;
    case 5: return -x;
    case 6: return  y;
    default: return -y;
  }
}

/**
 * 2D Perlin noise. Returns a value in roughly [-1, 1].
 * @param {number} x
 * @param {number} y
 * @param {Uint8Array} perm - 512-element permutation table from buildPermutation
 * @returns {number}
 */
export function perlin2(x, y, perm) {
  const xi0 = Math.floor(x) & 255;
  const yi0 = Math.floor(y) & 255;
  const xi1 = (xi0 + 1) & 255;
  const yi1 = (yi0 + 1) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);
  const aa = perm[perm[xi0] + yi0];
  const ab = perm[perm[xi0] + yi1];
  const ba = perm[perm[xi1] + yi0];
  const bb = perm[perm[xi1] + yi1];
  const x1 = lerp(grad(aa, xf,     yf    ), grad(ba, xf - 1, yf    ), u);
  const x2 = lerp(grad(ab, xf,     yf - 1), grad(bb, xf - 1, yf - 1), u);
  return Math.max(-1, Math.min(1, lerp(x1, x2, v)));
}

/**
 * Build a seeded 512-element permutation table for use with perlin2 / fbm01.
 * Uses createRng for the shuffle so the output is identical to the original
 * overworld.js implementation — overworld terrain is unchanged.
 * @param {number} seed - integer seed
 * @returns {Uint8Array}
 */
export function buildPermutation(seed) {
  const rng = createRng((seed ^ 0x9e3779b1) >>> 0);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (rng.next() * (i + 1)) | 0;
    const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return perm;
}

/**
 * Fractal Brownian Motion — multi-octave Perlin noise normalised to [0, 1].
 * @param {number} x
 * @param {number} y
 * @param {Uint8Array} perm
 * @param {{scale:number, oct:number, persist:number, lacun:number}} cfg
 * @returns {number} value in [0, 1]
 */
export function fbm01(x, y, perm, cfg) {
  let amp = 1;
  let freq = cfg.scale;
  let sum = 0;
  let ampSum = 0;
  for (let i = 0; i < cfg.oct; i++) {
    sum    += amp * perlin2(x * freq, y * freq, perm);
    ampSum += amp;
    amp    *= cfg.persist;
    freq   *= cfg.lacun;
  }
  return 0.5 * (sum / (ampSum || 1) + 1);
}

// --- dungeon generator ---

/**
 * Noise-based grotto generator.
 * Samples fBM at world coordinates so adjacent chunks tile seamlessly.
 * Returns chunk-local rooms (one synthetic room at the chunk center) for
 * stair and edge-gate placement — the actual navigable area is the noise
 * floor field, not the synthetic room bounds.
 *
 * @param {number} seed         - chunk seed (from chunkSeed())
 * @param {number} chunkX
 * @param {number} chunkY
 * @param {number} size         - CHUNK_SIZE
 * @returns {{ tiles: Uint8Array, rooms: Array<{x:number,y:number,w:number,h:number}> }}
 */
export function noiseGenerator(seed, chunkX, chunkY, size) {
  const perm = buildPermutation(seed);
  const cfg  = { scale: 0.10, oct: 3, persist: 0.55, lacun: 2.0 };
  const THRESHOLD = 0.48; // ~50 % floor density at this frequency

  const tiles = new Uint8Array(size * size);
  for (let ly = 0; ly < size; ly++) {
    for (let lx = 0; lx < size; lx++) {
      const wx = chunkX * size + lx;
      const wy = chunkY * size + ly;
      tiles[ly * size + lx] = fbm01(wx, wy, perm, cfg) < THRESHOLD
        ? TILE_FLOOR
        : TILE_WALL;
    }
  }

  // One synthetic room at the chunk centre for stair / edge-gate purposes.
  // Coords are chunk-local; chunk.js offsets them to world coords.
  const half = Math.floor(size / 2);
  const rooms = [{ x: half - 2, y: half - 2, w: 4, h: 4 }];

  return { tiles, rooms };
}
