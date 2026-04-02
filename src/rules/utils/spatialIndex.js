// rules/utils/spatialIndex.js
// Lightweight spatial index for entities with Position.

import { Position } from '../components/Position.js';
import { Changed } from '../../lib/ecs-js/index.js';
import { CHUNK_SIZE } from '../environment/dungeon/constants.js';

/** @typedef {{ byCell: Map<string, Set<number>>, entityCell: Map<number, string>, lastStep: number, seeded: boolean, lastBackfillStep: number }} SpatialState */

/** @type {WeakMap<object, SpatialState>} */
const _states = new WeakMap();

const CELL_SIZE = CHUNK_SIZE;

function _key(cx, cy) { return `${cx},${cy}`; }
function _cell(x, y) {
  const cx = Math.floor(x / CELL_SIZE);
  const cy = Math.floor(y / CELL_SIZE);
  return { cx, cy, key: _key(cx, cy) };
}

/** @param {import('../../lib/ecs-js/index.js').World} world */
function _state(world) {
  let st = _states.get(world);
  if (!st) {
    st = { byCell: new Map(), entityCell: new Map(), lastStep: -1, seeded: false, lastBackfillStep: -1 };
    _states.set(world, st);
  }
  return st;
}

function _addToCell(st, key, id) {
  let set = st.byCell.get(key);
  if (!set) { set = new Set(); st.byCell.set(key, set); }
  set.add(id);
}

function _removeFromCell(st, key, id) {
  const set = st.byCell.get(key);
  if (!set) return;
  set.delete(id);
  if (set.size === 0) st.byCell.delete(key);
}

function _syncEntityCell(st, id, pos) {
  const { key } = _cell(pos.x, pos.y);
  const prev = st.entityCell.get(id);
  if (prev === key) return;
  if (prev) _removeFromCell(st, prev, id);
  _addToCell(st, key, id);
  st.entityCell.set(id, key);
}

/** Full rebuild. Use sparingly. */
export function rebuildSpatialIndex(world) {
  const st = _state(world);
  st.byCell.clear();
  st.entityCell.clear();
  for (const [id, pos] of world.query(Position)) {
    const { key } = _cell(pos.x, pos.y);
    _addToCell(st, key, id);
    st.entityCell.set(id, key);
  }
  st.lastStep = world.step | 0;
  st.seeded = true;
  st.lastBackfillStep = world.step | 0;
}

/** Update index from Changed(Position). Should run once per tick (after movement). */
export function updateSpatialIndex(world) {
  const st = _state(world);
  if (!st.seeded) rebuildSpatialIndex(world);
  for (const [id, pos] of world.query(Position, Changed(Position))) {
    _syncEntityCell(st, id, pos);
  }
  st.lastStep = world.step | 0;
}

/** Ensure index exists for current world state (safe to call from render). */
export function ensureSpatialIndex(world) {
  const st = _state(world);
  if (!st.seeded) {
    rebuildSpatialIndex(world);
    return;
  }
  const step = world.step | 0;
  if (st.lastBackfillStep === step) return;

  // Render-side safety net: deferred structural changes may miss same-tick
  // cleanup sync; backfill any Position entities absent from the index.
  for (const [id, pos] of world.query(Position)) {
    if (st.entityCell.has(id)) continue;
    const { key } = _cell(pos.x, pos.y);
    _addToCell(st, key, id);
    st.entityCell.set(id, key);
  }
  st.lastBackfillStep = step;
}

/** Clear index for a world (e.g., on floor transition). */
export function clearSpatialIndex(world) {
  const st = _state(world);
  st.byCell.clear();
  st.entityCell.clear();
  st.lastStep = -1;
  st.lastBackfillStep = -1;
  st.seeded = false;
}

/**
 * Iterate entities with Position in a world-space rect.
 * Stale entities are cleaned up lazily.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {(id:number, pos:{x:number,y:number})=>void} cb
 */
export function forEachInRect(world, x0, y0, x1, y1, cb) {
  const st = _state(world);
  if (!st.seeded) rebuildSpatialIndex(world);

  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);

  const c0 = Math.floor(minX / CELL_SIZE);
  const c1 = Math.floor(maxX / CELL_SIZE);
  const r0 = Math.floor(minY / CELL_SIZE);
  const r1 = Math.floor(maxY / CELL_SIZE);

  for (let cy = r0; cy <= r1; cy++) {
    for (let cx = c0; cx <= c1; cx++) {
      const set = st.byCell.get(_key(cx, cy));
      if (!set) continue;
      for (const id of set) {
        if (!world.isAlive(id)) {
          _removeFromCell(st, _key(cx, cy), id);
          st.entityCell.delete(id);
          continue;
        }
        const pos = world.get(id, Position);
        if (!pos) {
          _removeFromCell(st, _key(cx, cy), id);
          st.entityCell.delete(id);
          continue;
        }
        // Repair misplaced entities if needed.
        _syncEntityCell(st, id, pos);
        if (pos.x < minX || pos.x > maxX || pos.y < minY || pos.y > maxY) continue;
        cb(id, pos);
      }
    }
  }
}

/**
 * Iterate entities within a Chebyshev radius around (x,y).
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} x
 * @param {number} y
 * @param {number} r
 * @param {(id:number, pos:{x:number,y:number})=>void} cb
 */
export function forEachInRadius(world, x, y, r, cb) {
  const rr = Math.max(0, r | 0);
  forEachInRect(world, x - rr, y - rr, x + rr, y + rr, cb);
}

/**
 * Return all entity IDs at an exact (x,y) world-space point.
 * Uses the spatial index cell for O(1)-ish lookup instead of scanning all entities.
 * Stale entries are cleaned lazily.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} x
 * @param {number} y
 * @returns {number[]}
 */
export function entitiesAtPoint(world, x, y) {
  const st = _state(world);
  if (!st.seeded) rebuildSpatialIndex(world);

  const { key } = _cell(x, y);
  const set = st.byCell.get(key);
  if (!set) return [];

  const result = [];
  for (const id of set) {
    if (!world.isAlive(id)) {
      _removeFromCell(st, key, id);
      st.entityCell.delete(id);
      continue;
    }
    const pos = world.get(id, Position);
    if (!pos) {
      _removeFromCell(st, key, id);
      st.entityCell.delete(id);
      continue;
    }
    _syncEntityCell(st, id, pos);
    if (pos.x === x && pos.y === y) result.push(id);
  }
  return result;
}
