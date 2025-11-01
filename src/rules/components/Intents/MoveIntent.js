import { defineComponent } from "../../../lib/ecs-js/index.js";
/**
 * MoveIntent — request for an actor to move one tile in a direction.
 * actor entity holds this component for one tick; systems will consume and remove it.
 * Fields:
 * - dx: horizontal movement (e.g. -1, 0, 1)
 * - dy: vertical movement (e.g. -1, 0, 1)
 */
export const MoveIntent = defineComponent("MoveIntent", {
    dx: 0,
    dy: 0,
}, {
    validate(rec) {
        return Number.isInteger(rec.dx) && Number.isInteger(rec.dy)
    }
});