import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Encumbrance — derived carrying-load state, recomputed each effects phase.
 *
 * Managed by encumbranceSystem from the authoritative inventory-root weight.
 * Limit = Stamina.maxStamina (1:1 kg). No Stamina component = unlimited carry.
 * Consumed by movementSystem: overloaded entities cannot move diagonally.
 *
 * current:       Total carried weight (kg) of the inventory root subtree.
 * overloaded:    true when current > Stamina.maxStamina.
 * heavilyLoaded: true when current > maxStamina * 0.75 (approaching the limit).
 */
export const Encumbrance = defineComponent("Encumbrance", {
  current:      0,      // kg
  overloaded:   false,
  heavilyLoaded: false,
});
