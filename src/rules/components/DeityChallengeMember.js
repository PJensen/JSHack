import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Marks a monster as part of a deity-authored challenge.
 */
export const DeityChallengeMember = defineComponent("DeityChallengeMember", {
  challengeId: 0,
  deityId: "",
  playerId: 0,
});
