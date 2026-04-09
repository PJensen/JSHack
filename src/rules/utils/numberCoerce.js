/**
 * Clamp a value to an integer lower bound with fallback.
 * @param {any} value
 * @param {number} fallback
 * @param {number} [min]
 */
export function clampInt(value, fallback, min = 0) {
  const n = Number.isFinite(value) ? (value | 0) : fallback;
  return Math.max(min, n | 0);
}

/**
 * Clamp a numeric value to [0, 1] with zero fallback.
 * @param {any} value
 */
export function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * Clamp a numeric value to [0, 1] with explicit fallback.
 * @param {any} value
 * @param {number} fallback
 */
export function clamp01Or(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return clamp01(fallback);
  return clamp01(n);
}

/**
 * Convert to int with fallback.
 * @param {any} value
 * @param {number} [fallback]
 */
export function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? (n | 0) : (Number(fallback) | 0);
}
