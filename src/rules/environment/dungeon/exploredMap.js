// rules/environment/dungeon/exploredMap.js
// Singleton FOV and explored-tile storage for fog-of-war.
// Mirrors the tileMap.js singleton pattern.

import { computeFOV } from '../../../shared/math/fov.js';
import { CHUNK_SIZE } from './constants.js';
import { isPointInFacingCone } from '../../utils/facing.js';

/** @type {Map<string, Uint8Array>} tiles the player has ever seen on this depth */
const _explored = new Map();
/** @type {Map<string, Uint8Array>} tiles currently in the player's FOV */
const _visible = new Map();
/** @type {Uint8Array[]} reusable visible chunk buffers */
const _visiblePool = [];
/** @type {boolean} globally disable FOV visibility gating when true */
let _fovDisabled = false;

/** @type {number} */
let _lastStep = -1;
/** @type {number} */
let _lastPx = 0;
/** @type {number} */
let _lastPy = 0;
/** @type {number} */
let _lastRadius = -1;
/** @type {number} */
let _lastFacingDx = 0;
/** @type {number} */
let _lastFacingDy = 0;
/** @type {number} */
let _lastConeDegrees = 360;
/** @type {((x:number,y:number)=>boolean)|null} */
let _lastIsBlocked = null;

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
 * @param {{ facingDx?: number, facingDy?: number, coneDegrees?: number }} [opts]
 */
export function updateFOV(step, px, py, radius, isBlocked, opts = undefined) {
  if (_fovDisabled) return;
  const facingDx = Math.sign(Number(opts?.facingDx || 0));
  const facingDy = Math.sign(Number(opts?.facingDy || 0));
  const coneDegrees = Number(opts?.coneDegrees ?? 360);
  const sameInputs = (
    step === _lastStep
    && (px | 0) === _lastPx
    && (py | 0) === _lastPy
    && (radius | 0) === _lastRadius
    && facingDx === _lastFacingDx
    && facingDy === _lastFacingDy
    && coneDegrees === _lastConeDegrees
    && isBlocked === _lastIsBlocked
  );
  if (sameInputs) return;

  _lastStep = step | 0;
  _lastPx = px | 0;
  _lastPy = py | 0;
  _lastRadius = radius | 0;
  _lastFacingDx = facingDx;
  _lastFacingDy = facingDy;
  _lastConeDegrees = coneDegrees;
  _lastIsBlocked = isBlocked;
  _clearVisible();
  const coneActive = (facingDx !== 0 || facingDy !== 0) && coneDegrees < 360;
  computeFOV(px, py, radius, isBlocked, (x, y) => {
    if (coneActive && !isPointInFacingCone(px, py, x, y, facingDx, facingDy, coneDegrees)) return;
    _set(_visible, x, y);
  });
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
export function isVisible(x, y) {
  if (_fovDisabled) return true;
  return _has(_visible, x, y);
}

/** @returns {(x:number, y:number) => boolean} */
export function isExplored(x, y) { return _has(_explored, x, y); }

/** Mark a single tile as explored (for map-reveal effects). */
export function markExplored(x, y) { _set(_explored, x, y); }

/** Clear all explored/visible data (call on depth transition). */
export function clearExplored() {
  _explored.clear();
  _clearVisible();
  _lastStep = -1;
  _lastPx = 0;
  _lastPy = 0;
  _lastRadius = -1;
  _lastFacingDx = 0;
  _lastFacingDy = 0;
  _lastConeDegrees = 360;
  _lastIsBlocked = null;
}

/**
 * Randomly zero out a fraction of explored tiles on the current floor.
 * Each explored byte has `fraction` probability of being forgotten.
 * @param {number} fraction - probability [0,1] of forgetting each tile
 * @param {() => number} rngFn - returns float in [0,1)
 */
export function degradeExplored(fraction, rngFn) {
  for (const chunk of _explored.values()) {
    for (let i = 0; i < chunk.length; i++) {
      if (chunk[i] && rngFn() < fraction) {
        chunk[i] = 0;
      }
    }
  }
}

/**
 * Snapshot the current explored chunks so they can be restored later.
 * @returns {Map<string, Uint8Array>} deep copy of explored state
 */
export function saveExplored() {
  const snap = new Map();
  for (const [key, chunk] of _explored) {
    snap.set(key, new Uint8Array(chunk));
  }
  return snap;
}

/**
 * Restore a previously saved explored snapshot.
 * Merges into (currently empty) explored map.
 * @param {Map<string, Uint8Array>} snap
 */
export function restoreExplored(snap) {
  if (!snap) return;
  for (const [key, chunk] of snap) {
    _explored.set(key, new Uint8Array(chunk));
  }
}

/** Globally disable or enable FOV visibility checks. */
export function setFovDisabled(disabled) {
  _fovDisabled = !!disabled;
  if (_fovDisabled) _clearVisible();
}
