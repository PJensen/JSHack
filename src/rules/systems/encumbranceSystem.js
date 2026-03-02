import { Inventory } from "../components/Inventory.js";
import { Encumbrance } from "../components/Encumbrance.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Equipment, GEAR_SLOTS } from "../components/Equipment.js";
import { Stamina } from "../components/Stamina.js";

const HEAVY_LOAD_RATIO = 0.75;

/**
 * Recomputes Encumbrance from Inventory + equipped gear each effects phase.
 *
 * current       = sum of (ItemInfo.weight * count) for held items
 *               + sum of (ItemInfo.weight) for each occupied gear slot.
 * limit         = Stamina.maxStamina when the entity has Stamina (1:1 rule),
 *                 No Stamina component = unlimited carry.
 * overloaded    = current > limit (blocks diagonal movement).
 * heavilyLoaded = current > limit * 0.75 (approaching limit; future hooks).
 *
 * Both flags are false when limit is null/0 (unlimited carry).
 *
 * Phase: effects (runs after equipmentSystem so gear changes are committed).
 */
export function encumbranceSystem(world) {
  for (const [id, inv, enc] of world.query(Inventory, Encumbrance)) {
    let current = 0;

    // ── Held items (stacked) ─────────────────────────────────────────
    const items = inv.items;
    for (let i = 0; i < items.length; i++) {
      const itemId = items[i];
      if (!itemId || !world.isAlive(itemId)) continue;
      const info = world.get(itemId, ItemInfo);
      if (!info) continue;
      current += (Number(info.weight) || 0) * Math.max(1, (info.count | 0));
    }

    // ── Equipped gear (singular — no count multiplier) ───────────────
    const eq = world.get(id, Equipment);
    if (eq) {
      for (let i = 0; i < GEAR_SLOTS.length; i++) {
        const slotId = eq[GEAR_SLOTS[i]];
        if (!slotId || !world.isAlive(slotId)) continue;
        const info = world.get(slotId, ItemInfo);
        if (!info) continue;
        current += Number(info.weight) || 0;
      }
    }

    enc.current = current;

    // ── Determine limit ──────────────────────────────────────────────
    // Carry capacity = Stamina.maxStamina (1:1 kg). No Stamina = unlimited.
    const stam  = world.get(id, Stamina);
    const limit = stam ? stam.maxStamina : null;

    if (limit != null && limit > 0) {
      enc.overloaded    = current > limit;
      enc.heavilyLoaded = current > limit * HEAVY_LOAD_RATIO;
    } else {
      enc.overloaded    = false;
      enc.heavilyLoaded = false;
    }
  }
}
