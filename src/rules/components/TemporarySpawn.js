import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * TemporarySpawn marks a materialized entity as non-permanent.
 *
 * The expiry time is absolute world.step time so save/restore and depth changes
 * can rebuild wakeups from ECS data instead of carrying hidden world state.
 */
export const TemporarySpawn = defineComponent("TemporarySpawn", {
  createdAtTurn: 0,
  expiresAtTurn: 0,
  replacementKind: "",
  source: "",
});
