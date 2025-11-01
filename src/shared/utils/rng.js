// shared/utils/rng.js
// Visual/game-agnostic RNG helpers. For rules, prefer world.rand where available.

export function makeRng(seed = 0) {
  let t = (seed >>> 0) || 0x12345678;
  return function rng() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296; // 0..1
  };
}
