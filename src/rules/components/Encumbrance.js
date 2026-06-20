import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Encumbrance — derived carrying-load state, recomputed each effects phase.
 *
 * Managed by encumbranceSystem from the authoritative inventory-root weight.
 * Limit is derived from effective max stamina and encumbrance tuning.
 * Consumed by movementSystem: overloaded entities cannot move diagonally.
 *
 * current:       Total carried weight (kg) of the inventory root subtree.
 * limit:         Normal carrying capacity in kg.
 * hardLimit:     Maximum weight accepted by pickup systems.
 * loadRatio:     current / limit.
 */
export const Encumbrance = defineComponent("Encumbrance", {
  current:      0,      // kg
  limit:        null,
  hardLimit:    null,
  loadRatio:    0,
  overloaded:   false,
  heavilyLoaded: false,
});
