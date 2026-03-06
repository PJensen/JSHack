import { Inventory } from "../components/Inventory.js";
import { Encumbrance } from "../components/Encumbrance.js";
import { Stamina } from "../components/Stamina.js";
import { getCarriedWeight } from "../utils/inventoryFacade.js";

const HEAVY_LOAD_RATIO = 0.75;

/**
 * Recomputes Encumbrance from the authoritative inventory-root weight.
 *
 * current       = total carried weight of the inventory root subtree.
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
  for (const [id, , enc] of world.query(Inventory, Encumbrance)) {
    const current = getCarriedWeight(world, id);
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
