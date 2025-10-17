// Small math helpers

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function mod(n, m) {
  return ((n % m) + m) % m;
}

export function approxEqual(a, b, eps = 1e-6) {
  return Math.abs(a - b) <= eps;
}

export function sign(n) {
  return n < 0 ? -1 : n > 0 ? 1 : 0;
}

// rng-aware range helper using a provided RNG function
export function rngRange(rng, lo, hi) {
  return Math.floor(rng() * (hi - lo + 1)) + lo;
}
