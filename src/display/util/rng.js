// display/util/rng.js
// Visual-only RNG; mulberry32-based and returns a 0..1 PRNG function.

export function makeRng(seed = 0) {
  let t = (seed >>> 0) || 0x12345678;
  return function rng() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296; // 0..1
  };
}
