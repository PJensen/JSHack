import { Beatitude } from "../components/Beatitude.js";
import { NamedIdentity } from "../components/NamedIdentity.js";

/**
 * True if the item is currently cursed (welded to its carrier).
 *
 * @param {object} world
 * @param {number} itemId
 * @returns {boolean}
 */
export function isItemCursed(world, itemId) {
  if (!Number.isInteger(itemId) || itemId <= 0) return false;
  const beat = world.get(itemId, Beatitude);
  return beat?.state === 'cursed';
}

/**
 * If itemId is cursed, emits `item:welded` so the UI can report it and
 * returns true — the caller must abort the operation.
 * If not cursed, returns false — displacement is safe to proceed.
 *
 * This is the single enforcement point for the "cursed items are welded"
 * contract.  All equip, displace, disarm, and steal paths must go through
 * this rather than doing ad-hoc Beatitude checks.
 *
 * @param {object} world
 * @param {number} actor  — entity attempting the action (for UI routing)
 * @param {number} itemId — item being displaced
 * @returns {boolean}     — true = blocked, false = safe
 */
export function blockIfCursed(world, actor, itemId) {
  if (!isItemCursed(world, itemId)) return false;
  world.emit('item:welded', {
    actor,
    itemId,
    slot: null,
    name: world.get(itemId, NamedIdentity)?.name,
  });
  return true;
}
