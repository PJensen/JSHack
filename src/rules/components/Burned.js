import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Burned marks an entity as destroyed-in-world but retained for reconstruction.
 * Display and interaction layers should treat these entities as gone.
 */
export const Burned = defineComponent("Burned", {
  atTurn: 0,
  cause: "",
  sourceId: 0,
  sourceKind: "",
  smokeTurnsLeft: 0,
});
