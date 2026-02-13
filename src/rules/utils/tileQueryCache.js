// rules/utils/tileQueryCache.js
// Shared per-tick tile query cache for rules systems.

import { Position } from "../components/Position.js";
import { Vitality } from "../components/Vitality.js";
import { ItemInfo } from "../components/ItemInfo.js";

/** @typedef {{ byCell: Map<string, Set<number>>, livingByCell: Map<string, number>, itemsByCell: Map<string, number[]>, lastStep: number }} TileQueryState */

/** @type {WeakMap<object, TileQueryState>} */
const _states = new WeakMap();

/** @param {number} x @param {number} y */
function _key(x, y) {
  return `${x},${y}`;
}

/** @param {import('../../lib/ecs-js/index.js').World} world */
function _state(world) {
  let st = _states.get(world);
  if (!st) {
    st = {
      byCell: new Map(),
      livingByCell: new Map(),
      itemsByCell: new Map(),
      lastStep: -1,
    };
    _states.set(world, st);
  }
  return st;
}

/** @param {TileQueryState} st @param {number} id @param {string} k */
function _addToCell(st, id, k) {
  let set = st.byCell.get(k);
  if (!set) {
    set = new Set();
    st.byCell.set(k, set);
  }
  set.add(id);
}

/** @param {TileQueryState} st @param {number} id @param {string} k */
function _addItem(st, id, k) {
  let arr = st.itemsByCell.get(k);
  if (!arr) {
    arr = [];
    st.itemsByCell.set(k, arr);
  }
  arr.push(id);
}

/** @param {import('../../lib/ecs-js/index.js').World} world */
function _rebuild(world) {
  const st = _state(world);
  st.byCell.clear();
  st.livingByCell.clear();
  st.itemsByCell.clear();

  for (const [id, pos] of world.query(Position)) {
    const k = _key(pos.x, pos.y);
    _addToCell(st, id, k);

    const vit = world.get(id, Vitality);
    if (vit && (vit.hp ?? 0) > 0 && !st.livingByCell.has(k)) {
      st.livingByCell.set(k, id);
    }

    const info = world.get(id, ItemInfo);
    if (info && info.type) {
      _addItem(st, id, k);
    }
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
 * Get a living entity id on a tile, or 0 if none.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function getLivingEntityAt(world, x, y) {
  const st = _ensure(world);
  const k = _key(x, y);

  const cached = st.livingByCell.get(k);
  if (cached && world.isAlive(cached)) {
    const pos = world.get(cached, Position);
    const vit = world.get(cached, Vitality);
    if (pos && pos.x === x && pos.y === y && vit && (vit.hp ?? 0) > 0) {
      return cached;
    }
  }

  const set = st.byCell.get(k);
  if (!set) return 0;
  for (const id of set) {
    if (!world.isAlive(id)) continue;
    const pos = world.get(id, Position);
    if (!pos || pos.x !== x || pos.y !== y) continue;
    const vit = world.get(id, Vitality);
    if (!vit || (vit.hp ?? 0) <= 0) continue;
    st.livingByCell.set(k, id);
    return id;
  }
  st.livingByCell.delete(k);
  return 0;
}

/**
 * Get item entity ids currently on a tile.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} x
 * @param {number} y
 * @returns {number[]}
 */
export function getItemsAt(world, x, y) {
  const st = _ensure(world);
  const arr = st.itemsByCell.get(_key(x, y));
  if (!arr || arr.length === 0) return [];

  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const id = arr[i];
    if (!world.isAlive(id)) continue;
    const pos = world.get(id, Position);
    if (!pos || pos.x !== x || pos.y !== y) continue;
    const info = world.get(id, ItemInfo);
    if (!info || !info.type) continue;
    out.push(id);
  }
  return out;
}

/**
 * Iterate entity ids currently on a tile.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} x
 * @param {number} y
 * @param {(id:number)=>void} cb
 */
export function forEachAt(world, x, y, cb) {
  const st = _ensure(world);
  const set = st.byCell.get(_key(x, y));
  if (!set) return;
  for (const id of set) {
    if (!world.isAlive(id)) continue;
    const pos = world.get(id, Position);
    if (!pos || pos.x !== x || pos.y !== y) continue;
    cb(id);
  }
}

