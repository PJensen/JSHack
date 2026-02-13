// rules/utils/tileQueryCache.js
// Shared per-tick tile query cache for rules systems.

import { Position } from "../components/Position.js";
import { Vitality } from "../components/Vitality.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Collider } from "../components/Collider.js";
import { Interactable } from "../components/Interactable.js";

/** @typedef {{ byCell: Map<string, number[]>, itemsByCell: Map<string, number[]>, livingByCell: Map<string, number>, interactableByCell: Map<string, number>, blockedByCell: Set<string>, lastStep: number }} TileQueryState */

/** @type {WeakMap<object, TileQueryState>} */
const _states = new WeakMap();

/** @type {number[]} */
const EMPTY_IDS = Object.freeze([]);

/** @param {number} x @param {number} y */
function _key(x, y) {
  return `${x},${y}`;
}

/** @param {TileQueryState} st @param {string} k @param {number} id */
function _pushByCell(st, k, id) {
  let arr = st.byCell.get(k);
  if (!arr) {
    arr = [];
    st.byCell.set(k, arr);
  }
  arr.push(id);
}

/** @param {TileQueryState} st @param {string} k @param {number} id */
function _pushItem(st, k, id) {
  let arr = st.itemsByCell.get(k);
  if (!arr) {
    arr = [];
    st.itemsByCell.set(k, arr);
  }
  arr.push(id);
}

/** @param {import('../../lib/ecs-js/index.js').World} world */
function _state(world) {
  let st = _states.get(world);
  if (!st) {
    st = {
      byCell: new Map(),
      itemsByCell: new Map(),
      livingByCell: new Map(),
      interactableByCell: new Map(),
      blockedByCell: new Set(),
      lastStep: -1,
    };
    _states.set(world, st);
  }
  return st;
}

/** @param {import('../../lib/ecs-js/index.js').World} world */
function _rebuild(world) {
  const st = _state(world);
  st.byCell.clear();
  st.itemsByCell.clear();
  st.livingByCell.clear();
  st.interactableByCell.clear();
  st.blockedByCell.clear();

  for (const [id, pos] of world.query(Position)) {
    const k = _key(pos.x, pos.y);
    _pushByCell(st, k, id);

    const col = world.get(id, Collider);
    if (col && col.solid) st.blockedByCell.add(k);

    const vit = world.get(id, Vitality);
    if (vit && (vit.hp ?? 0) > 0) {
      st.blockedByCell.add(k);
      if (!st.livingByCell.has(k)) st.livingByCell.set(k, id);
    }

    if (world.has(id, Interactable) && !st.interactableByCell.has(k)) {
      st.interactableByCell.set(k, id);
    }

    const info = world.get(id, ItemInfo);
    if (info && info.type) _pushItem(st, k, id);
  }

  st.lastStep = world.step | 0;
}

/** @param {import('../../lib/ecs-js/index.js').World} world */
function _ensure(world) {
  const st = _state(world);
  const step = world.step | 0;
  if (st.lastStep !== step) _rebuild(world);
  return st;
}

/** Invalidate cache for explicit structural changes inside the same tick. */
export function invalidateTileQueryCache(world) {
  const st = _state(world);
  st.lastStep = -1;
}

/**
 * Ensure and return the current step snapshot.
 * Treat fields as read-only from callers.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @returns {TileQueryState}
 */
export function getTileQuerySnapshot(world) {
  return _ensure(world);
}

/**
 * Get a living entity id on a tile, or 0 if none.
 * Snapshot semantics: reflects the state at cache rebuild for this tick.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function getLivingEntityAt(world, x, y) {
  return _ensure(world).livingByCell.get(_key(x, y)) || 0;
}

/**
 * Get item ids on a tile from the current tick snapshot.
 * Returned array is cache-owned; callers must treat it as read-only.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} x
 * @param {number} y
 * @returns {number[]}
 */
export function getItemsAt(world, x, y) {
  return _ensure(world).itemsByCell.get(_key(x, y)) || EMPTY_IDS;
}

/**
 * Zero-allocation iteration of cached item ids at tile.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} x
 * @param {number} y
 * @param {(id:number)=>void} cb
 */
export function forEachItemAt(world, x, y, cb) {
  const arr = _ensure(world).itemsByCell.get(_key(x, y));
  if (!arr) return;
  for (let i = 0; i < arr.length; i++) cb(arr[i]);
}

/**
 * Iterate entity ids currently on a tile from the per-tick snapshot.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} x
 * @param {number} y
 * @param {(id:number)=>void} cb
 */
export function forEachAt(world, x, y, cb) {
  const arr = _ensure(world).byCell.get(_key(x, y));
  if (!arr) return;
  for (let i = 0; i < arr.length; i++) cb(arr[i]);
}

