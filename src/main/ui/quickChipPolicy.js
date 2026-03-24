import { Equipment, GEAR_SLOTS } from "../../rules/components/Equipment.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";

function normalizeIdentity(value) {
  return String(value || "").trim().toLowerCase();
}

/**
 * Suppress quick-chip for inventory pickups that duplicate an already equipped
 * item identity (including ammo).
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} ownerId
 * @param {number} itemId
 * @returns {boolean}
 */
export function shouldSuppressRecentPickupChipForEquippedDuplicate(world, ownerId, itemId) {
  if (!(ownerId > 0) || !(itemId > 0) || !world.isAlive(itemId)) return false;
  const equipment = world.get(ownerId, Equipment);
  if (!equipment) return false;

  const pickupIdentity = normalizeIdentity(world.get(itemId, NamedIdentity)?.identity);
  if (!pickupIdentity) return false;

  for (const slot of GEAR_SLOTS) {
    const equippedId = equipment[slot];
    if (!Number.isInteger(equippedId) || equippedId <= 0 || !world.isAlive(equippedId)) continue;
    const equippedIdentity = normalizeIdentity(world.get(equippedId, NamedIdentity)?.identity);
    if (equippedIdentity && equippedIdentity === pickupIdentity) return true;
  }

  return false;
}
