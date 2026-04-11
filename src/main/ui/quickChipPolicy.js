import { Equipment } from "../../rules/components/Equipment.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";

function normalizeIdentity(value) {
  return String(value || "").trim().toLowerCase();
}

/**
 * Suppress quick-chip for ammo pickups that duplicate already-equipped ammo.
 * Non-ammo equipped duplicates (e.g. dual-wielded weapons) are allowed through
 * so the player can interact with them via the chip.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} ownerId
 * @param {number} itemId
 * @returns {boolean}
 */
export function shouldSuppressRecentPickupChipForEquippedDuplicate(world, ownerId, itemId) {
  if (!(ownerId > 0) || !(itemId > 0) || !world.isAlive(itemId)) return false;

  const info = world.get(itemId, ItemInfo);
  if (!info || info.type !== 'ammo') return false;

  const equipment = world.get(ownerId, Equipment);
  if (!equipment) return false;

  const equippedAmmoId = equipment.ammo;
  if (!Number.isInteger(equippedAmmoId) || equippedAmmoId <= 0 || !world.isAlive(equippedAmmoId)) return false;

  const pickupIdentity = normalizeIdentity(world.get(itemId, NamedIdentity)?.identity);
  if (!pickupIdentity) return false;

  const equippedIdentity = normalizeIdentity(world.get(equippedAmmoId, NamedIdentity)?.identity);
  return equippedIdentity === pickupIdentity;
}
