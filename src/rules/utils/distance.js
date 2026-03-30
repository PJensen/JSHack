// rules/utils/distance.js
// Canonical distance helpers used across the codebase.

/**
 * Chebyshev distance between two points (object form).
 * @param {{x:number, y:number}} a
 * @param {{x:number, y:number}} b
 * @returns {number}
 */
export function chebyshev(a, b) {
  return Math.max(
    Math.abs((a.x | 0) - (b.x | 0)),
    Math.abs((a.y | 0) - (b.y | 0)),
  );
}

/**
 * Chebyshev distance between two points (scalar form).
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 * @returns {number}
 */
export function chebyshevScalar(ax, ay, bx, by) {
  return Math.max(Math.abs((ax | 0) - (bx | 0)), Math.abs((ay | 0) - (by | 0)));
}

/**
 * Manhattan distance between two points (object form).
 * @param {{x:number, y:number}} a
 * @param {{x:number, y:number}} b
 * @returns {number}
 */
export function manhattan(a, b) {
  return Math.abs((a.x | 0) - (b.x | 0)) + Math.abs((a.y | 0) - (b.y | 0));
}

/**
 * Manhattan distance between two points (scalar form).
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 * @returns {number}
 */
export function manhattanScalar(ax, ay, bx, by) {
  return Math.abs((ax | 0) - (bx | 0)) + Math.abs((ay | 0) - (by | 0));
}
