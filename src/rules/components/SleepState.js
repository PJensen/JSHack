import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * SleepState — rules-side actor sleep/incapacitation state.
 *
 * Keep this separate from Brain: sleeping is a body/action state, not a
 * cognition or perception capability.
 */
export const SleepState = defineComponent("SleepState", {
  asleep: true,
  wakeDifficulty: 8,
  wakeRadius: 2,
  wakeOnDamage: true,
});
