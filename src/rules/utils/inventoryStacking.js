import { ItemInfo } from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Position } from "../components/Position.js";
import { Unpaid } from "../components/Unpaid.js";

/**
 * @typedef {{
 *   excludeId?: number,
 *   allowUnpaidStack?: boolean,
 * }} StackSearchOptions
 */

/**
 * @typedef {{
 *   removePosition?: boolean,
 *   allowUnpaidStack?: boolean,
 *   forceOwnStack?: boolean,
 * }} AddToInventoryOptions
 */

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} itemId
 * @param {boolean} allowUnpaidStack
 */
function canItemParticipateInStacking(world, itemId, allowUnpaidStack) {
  if (!(itemId > 0)) return false;
  if (!world.isAlive(itemId)) return false;
  if (!allowUnpaidStack && world.has(itemId, Unpaid)) return false;
  return !!world.get(itemId, ItemInfo);
}

/**
 * Find a stack target in an inventory by identity.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {{ items:number[] }} inv
 * @param {string} identity
 * @param {StackSearchOptions} [opts]
 * @returns {number}
 */
export function findInventoryStackTargetByIdentity(world, inv, identity, opts = {}) {
  if (!inv || !Array.isArray(inv.items) || !identity) return 0;
  const excludeId = Number(opts.excludeId || 0);
  const allowUnpaidStack = opts.allowUnpaidStack === true;
  for (const id of inv.items) {
    if (!(id > 0) || id === excludeId) continue;
    if (!canItemParticipateInStacking(world, id, allowUnpaidStack)) continue;
    const n = world.get(id, NamedIdentity);
    if (n && n.identity === identity) return id;
  }
  return 0;
}

/**
 * Find a stack target in an inventory for the given item entity.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {{ items:number[] }} inv
 * @param {number} itemId
 * @param {StackSearchOptions} [opts]
 * @returns {number}
 */
export function findInventoryStackTargetForItem(world, inv, itemId, opts = {}) {
  if (!(itemId > 0)) return 0;
  const identity = world.get(itemId, NamedIdentity)?.identity;
  if (!identity) return 0;
  const allowUnpaidStack = opts.allowUnpaidStack === true;
  if (!canItemParticipateInStacking(world, itemId, allowUnpaidStack)) return 0;
  return findInventoryStackTargetByIdentity(world, inv, identity, {
    ...opts,
    excludeId: Number(opts.excludeId || itemId),
  });
}

/**
 * Merge duplicate stacks with the same identity already present in one inventory.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {{ items:number[] }} inv
 * @param {string} identity
 * @param {{ allowUnpaidStack?: boolean }} [opts]
 * @returns {number} surviving stack id or 0 if none
 */
export function coalesceInventoryStacksByIdentity(world, inv, identity, opts = {}) {
  if (!inv || !Array.isArray(inv.items) || !identity) return 0;
  const allowUnpaidStack = opts.allowUnpaidStack === true;
  /** @type {number[]} */
  const ids = [];
  const seen = new Set();
  for (const id of inv.items) {
    if (!(id > 0)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    if (!canItemParticipateInStacking(world, id, allowUnpaidStack)) continue;
    const n = world.get(id, NamedIdentity);
    if (n && n.identity === identity) ids.push(id);
  }
  if (ids.length === 0) return 0;
  if (ids.length === 1) return ids[0];

  const keepId = ids[0];
  for (let i = 1; i < ids.length; i++) {
    const id = ids[i];
    if (!(id > 0) || !world.isAlive(id)) continue;
    const info = world.get(id, ItemInfo);
    const addCount = info ? (info.count || 1) : 1;
    world.mutate(keepId, ItemInfo, (r) => { r.count = (r.count || 1) + addCount; });
    for (let j = inv.items.length - 1; j >= 0; j--) {
      if (inv.items[j] === id) inv.items.splice(j, 1);
    }
    world.destroy(id);
  }
  return keepId;
}

/**
 * Coalesce all stackable identities in an inventory.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {{ items:number[] }} inv
 * @param {{ allowUnpaidStack?: boolean }} [opts]
 */
export function coalesceInventoryStacks(world, inv, opts = {}) {
  if (!inv || !Array.isArray(inv.items)) return;
  const allowUnpaidStack = opts.allowUnpaidStack === true;
  const identities = new Set();
  for (const id of inv.items) {
    if (!(id > 0) || !world.isAlive(id)) continue;
    if (!allowUnpaidStack && world.has(id, Unpaid)) continue;
    const info = world.get(id, ItemInfo);
    if (!info) continue;
    const ident = world.get(id, NamedIdentity)?.identity;
    if (ident) identities.add(ident);
  }
  for (const identity of identities) {
    coalesceInventoryStacksByIdentity(world, inv, identity, { allowUnpaidStack });
  }
}

/**
 * Add an existing item entity to an inventory, stacking into an existing stack
 * when possible and allowed.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {{ items:number[] }} inv
 * @param {number} itemId
 * @param {AddToInventoryOptions} [opts]
 * @returns {{ ok:boolean, mode:'stacked'|'added'|'skipped', itemId:number, stackedIntoId:number, count:number }}
 */
export function addItemEntityToInventory(world, inv, itemId, opts = {}) {
  if (!inv || !Array.isArray(inv.items) || !(itemId > 0) || !world.isAlive(itemId)) {
    return { ok: false, mode: "skipped", itemId, stackedIntoId: 0, count: 0 };
  }
  const info = world.get(itemId, ItemInfo);
  if (!info) return { ok: false, mode: "skipped", itemId, stackedIntoId: 0, count: 0 };

  const allowUnpaidStack = opts.allowUnpaidStack === true;
  const forceOwnStack = opts.forceOwnStack === true;
  const count = info.count || 1;
  let stackedIntoId = 0;

  if (!forceOwnStack) {
    const ident = world.get(itemId, NamedIdentity)?.identity;
    if (ident && canItemParticipateInStacking(world, itemId, allowUnpaidStack)) {
      coalesceInventoryStacksByIdentity(world, inv, ident, { allowUnpaidStack });
      stackedIntoId = findInventoryStackTargetByIdentity(world, inv, ident, {
        excludeId: itemId,
        allowUnpaidStack,
      });
      if (stackedIntoId > 0) {
        world.mutate(stackedIntoId, ItemInfo, (r) => { r.count = (r.count || 1) + count; });
        for (let i = inv.items.length - 1; i >= 0; i--) {
          if (inv.items[i] === itemId) inv.items.splice(i, 1);
        }
        world.destroy(itemId);
        return { ok: true, mode: "stacked", itemId, stackedIntoId, count };
      }
    }
  }

  if (opts.removePosition !== false) {
    try { world.remove(itemId, Position); } catch {}
  }
  if (!inv.items.includes(itemId)) inv.items.push(itemId);
  return { ok: true, mode: "added", itemId, stackedIntoId: 0, count };
}
