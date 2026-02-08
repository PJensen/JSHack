// rules/environment/dungeon/exploredMap.js
// Singleton FOV and explored-tile storage for fog-of-war.
// Mirrors the tileMap.js singleton pattern.

import { computeFOV } from '../../../shared/math/fov.js';

/** @type {Set<string>} tiles the player has ever seen on this depth ("x,y" keys) */
const _explored = new Set();

/** @type {Set<string>} tiles currently in the player's FOV ("x,y" keys) */
const _visible = new Set();

/** @type {number} last world.step when FOV was computed */
let _lastStep = -1;

/**
 * Recompute FOV from player position. Idempotent within a turn.
 * @param {number} step    - current world.step
 * @param {number} px      - player world x
 * @param {number} py      - player world y
 * @param {number} radius  - vision radius
 * @param {(x:number, y:number) => boolean} isBlocked
 */
export function updateFOV(step, px, py, radius, isBlocked) {
  if (step === _lastStep) return;
  _lastStep = step;
  computeFOV(px, py, radius, isBlocked, _visible);
  for (const key of _visible) {
    _explored.add(key);
  }
}

/** @returns {Set<string>} current FOV (read-only reference) */
export function visible() { return _visible; }

/** @returns {Set<string>} all explored tiles on this depth (read-only reference) */
export function explored() { return _explored; }

/** Clear all explored/visible data (call on depth transition). */
export function clearExplored() {
  _explored.clear();
  _visible.clear();
  _lastStep = -1;
}
