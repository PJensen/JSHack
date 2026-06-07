import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Per-player cadence for deity-authored challenge pacing.
 */
export const DeityChallengeCadence = defineComponent("DeityChallengeCadence", {
  quietTurns: 0,
  lastChallengeStep: -999999,
});
