import { Inventory } from "../components/Inventory.js";
import { Encumbrance } from "../components/Encumbrance.js";
import { getCarriedWeight } from "../utils/inventoryFacade.js";
import { getCarryCapacity, resolveEncumbrance } from "../utils/encumbrance.js";

/**
 * Recomputes Encumbrance from the authoritative inventory-root weight.
 *
 * current       = total carried weight of the inventory root subtree.
 * limit         = effective max stamina * tunable kg-per-stamina multiplier.
 *
 * Both flags are false when limit is null/0 (unlimited carry).
 *
 * Phase: effects (runs after equipmentSystem so gear changes are committed).
 */
export function encumbranceSystem(world) {
  for (const [id, , enc] of world.query(Inventory, Encumbrance)) {
    const current = getCarriedWeight(world, id);
    enc.current = current;

    const state = resolveEncumbrance(current, getCarryCapacity(world, id));
    enc.limit = state.limit;
    enc.hardLimit = state.hardLimit;
    enc.loadRatio = state.loadRatio;
    enc.overloaded = state.overloaded;
    enc.heavilyLoaded = state.heavilyLoaded;
  }
}
