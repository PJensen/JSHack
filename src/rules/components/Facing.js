import { defineComponent } from "../../lib/ecs-js/index.js";
/**
 * Facing — the direction the entity last moved or attempted to move.
 * dx/dy: -1, 0, or 1 (cardinal or diagonal).  Defaults to (0,0) = no facing.
 */
export const Facing = defineComponent("Facing", { dx: 0, dy: 0 });
