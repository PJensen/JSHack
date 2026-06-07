import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * DeityAuthorshipState — runtime root for one deity-authored challenge.
 *
 * The root is floor-local. Spawned challenge monsters are children of this
 * entity and carry DeityChallengeMember records for per-monster tracking.
 */
export const DeityAuthorshipState = defineComponent("DeityAuthorshipState", {
  deityId: "",
  playerId: 0,
  kind: "challenge",
  reason: "",
  state: "active",
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  depth: 1,
  spawned: 0,
  remaining: 0,
  rewardSpawned: false,
  createdStep: 0,
  completedStep: 0,
});
