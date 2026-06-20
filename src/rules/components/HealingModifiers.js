import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Optional healing modifiers. Multipliers are applied by the canonical healing
 * pipeline; suppression is a 0..1 fraction removed after other modifiers.
 */
export const HealingModifiers = defineComponent("HealingModifiers", {
  outgoingMultiplier: 1,
  incomingMultiplier: 1,
  suppression: 0,
});
