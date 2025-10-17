// mulberry32 PRNG and small RNG helpers
// Usage:
//   const rng = mulberry32(seed);
//   rng() -> float in [0,1)

// Create a mulberry32 generator for a 32-bit integer seed
export function mulberry32(seed) {
  // ensure 32-bit unsigned
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Simple string -> numeric seed helper (js stable hash)
export function seedFromString(str) {
  // FNV-1a 32-bit hash
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// rng helpers that accept a generator function (rng)
export function rngFloat(rng, a = 0, b = 1) {
  return a + (b - a) * rng();
}

export function rngInt(rng, a, b) {
  // inclusive a..b
  const lo = Math.ceil(a);
  const hi = Math.floor(b);
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function rngChoice(rng, arr) {
  if (!arr || arr.length === 0) return undefined;
  return arr[Math.floor(rng() * arr.length)];
}

export function rngShuffle(rng, array) {
  // Fisher-Yates in-place
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = array[i];
    array[i] = array[j];
    array[j] = tmp;
  }
  return array;
}
