import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Durable gameplay state owned by a fountain entity.
 * Zero-valued fields are initialized deterministically on first interaction.
 */
export const FountainState = defineComponent("FountainState", {
  initialized: false,
  chargesRemaining: 0,
  maxCharges: 0,
  primaryEffect: "",
  cooldownTurns: 0,
  dryUntilStep: -1,
});
