// rules/environment/dungeon/exploredMap.js
// Singleton FOV and explored-tile storage for fog-of-war.
// Mirrors the tileMap.js singleton pattern.

import { computeFOV } from '../../../shared/math/fov.js';
import { CHUNK_SIZE } from './constants.js';

/** @type {Map<string, Uint8Array>} tiles the player has ever seen on this depth */
const _explored = new Map();
/** @type {Map<string, Uint8Array>} tiles currently in the player's FOV */
const _visible = new Map();
/** @type {Uint8Array[]} reusable visible chunk buffers */
const _visiblePool = [];

/** @type {number} last world.step when FOV was computed */
let _lastStep = -1;

/** @param {number} cx @param {number} cy */
function _key(cx, cy) { return `${cx},${cy}`; }

function _getChunk(map, cx, cy, create) {
  const key = _key(cx, cy);
  let chunk = map.get(key);
  if (!chunk && create) {
    chunk = map === _visible
      ? (_visiblePool.pop() || new Uint8Array(CHUNK_SIZE * CHUNK_SIZE))
      : new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    map.set(key, chunk);
  }
  return chunk;
}

function _set(map, x, y) {
  const cx = Math.floor(x / CHUNK_SIZE);
  const cy = Math.floor(y / CHUNK_SIZE);
  const lx = x - cx * CHUNK_SIZE;
  const ly = y - cy * CHUNK_SIZE;
  if (lx < 0 || ly < 0 || lx >= CHUNK_SIZE || ly >= CHUNK_SIZE) return;
  const chunk = _getChunk(map, cx, cy, true);
  chunk[ly * CHUNK_SIZE + lx] = 1;
}

function _has(map, x, y) {
  const cx = Math.floor(x / CHUNK_SIZE);
  const cy = Math.floor(y / CHUNK_SIZE);
  const lx = x - cx * CHUNK_SIZE;
  const ly = y - cy * CHUNK_SIZE;
  if (lx < 0 || ly < 0 || lx >= CHUNK_SIZE || ly >= CHUNK_SIZE) return false;
  const chunk = _getChunk(map, cx, cy, false);
  return !!(chunk && chunk[ly * CHUNK_SIZE + lx]);
}

function _clearVisible() {
  for (const chunk of _visible.values()) {
    chunk.fill(0);
    _visiblePool.push(chunk);
  }
  _visible.clear();
}

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
  _clearVisible();
  computeFOV(px, py, radius, isBlocked, (x, y) => _set(_visible, x, y));
  for (const [key, visChunk] of _visible) {
    const exploredChunk = _explored.get(key) || (() => {
      const c = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
      _explored.set(key, c);
      return c;
    })();
    for (let i = 0; i < visChunk.length; i++) {
      if (visChunk[i]) exploredChunk[i] = 1;
    }
  }
}

/** @returns {(x:number, y:number) => boolean} */
export function isVisible(x, y) { return _has(_visible, x, y); }

/** @returns {(x:number, y:number) => boolean} */
export function isExplored(x, y) { return _has(_explored, x, y); }

/** Clear all explored/visible data (call on depth transition). */
export function clearExplored() {
  _explored.clear();
  _clearVisible();
  _lastStep = -1;
}
