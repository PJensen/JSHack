// rules/utils/directions.js
// Canonical direction offset arrays.

/** Four cardinal directions (N, E, S, W — clockwise). */
export const CARDINAL_DIRS = Object.freeze([
  { dx:  0, dy: -1 },
  { dx:  1, dy:  0 },
  { dx:  0, dy:  1 },
  { dx: -1, dy:  0 },
]);

/** All eight directions (N, NE, E, SE, S, SW, W, NW — clockwise). */
export const ALL_DIRS = Object.freeze([
  { dx:  0, dy: -1 },
  { dx:  1, dy: -1 },
  { dx:  1, dy:  0 },
  { dx:  1, dy:  1 },
  { dx:  0, dy:  1 },
  { dx: -1, dy:  1 },
  { dx: -1, dy:  0 },
  { dx: -1, dy: -1 },
]);
