import { Equipment, NON_AMMO_GEAR_SLOTS } from "../components/Equipment.js";
import { ItemInfo } from "../components/ItemInfo.js";

/**
 * Returns true if the entity has any equipped item whose `tags` array includes
 * the given tag string.  Used for behavioral flags like "conflict", "sunlight",
 * "levitate" that aren't numeric bonuses.
 *
 * @param {any}    world
 * @param {number} entityId
 * @param {string} tag
 * @returns {boolean}
 */
export function hasEquippedTag(world, entityId, tag) {
  const eq = world.get(entityId, Equipment);
  if (!eq) return false;
  for (let i = 0; i < NON_AMMO_GEAR_SLOTS.length; i++) {
    const itemId = Number(eq[NON_AMMO_GEAR_SLOTS[i]] || 0) | 0;
    if (!(itemId > 0)) continue;
    const info = world.get(itemId, ItemInfo);
    if (info && Array.isArray(info.tags) && info.tags.includes(tag)) return true;
  }
  return false;
}
