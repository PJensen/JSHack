import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Durable gameplay state owned by a fountain entity.
 * Zero-valued fields are initialized deterministically on first interaction.
 */
export const FountainState = defineComponent("FountainState", {
  initialized: true,
  chargesRemaining: 3,
  maxCharges: 3,
  primaryEffect: "heal",
  cooldownTurns: 221,
  dryUntilStep: -1,
});
