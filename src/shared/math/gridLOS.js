// shared/math/gridLOS.js
// Grid-based line-of-sight using Bresenham. Pure math, no ECS deps.

import { bresenhamLine } from './bresenham.js';

/**
 * Check if there is an unblocked line of sight between two integer grid points.
 * The start tile is never checked. The end tile is never checked (you can always
 * "see" the tile you're looking at). Only intermediate tiles are tested.
 *
 * @param {number} x0 - start x (integer)
 * @param {number} y0 - start y (integer)
 * @param {number} x1 - end x (integer)
 * @param {number} y1 - end y (integer)
 * @param {(x:number, y:number) => boolean} isBlocked - returns true if tile blocks vision
 * @returns {boolean} true if LOS is clear
 */
export function hasLOS(x0, y0, x1, y1, isBlocked) {
  if (x0 === x1 && y0 === y1) return true;
  // Adjacent tiles (Chebyshev distance 1): always visible
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  if (dx <= 1 && dy <= 1) return true;

  // Walk Bresenham line; excludes start, includes end
  for (const [x, y] of bresenhamLine(x0, y0, x1, y1)) {
    // Don't check the target tile — you can see it even if it's a wall
    if (x === x1 && y === y1) break;
    if (isBlocked(x, y)) return false;
  }
  return true;
}
