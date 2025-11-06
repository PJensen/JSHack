import { defineComponent } from "../../../lib/ecs-js/index.js";
/**
 * MoveIntent — request for an actor to move within the analytic world.
 * Fields:
 * - dx, dy: desired direction vector (need not be unit length)
 * - distance?: optional override for stride distance this tick
 */
export const MoveIntent = defineComponent("MoveIntent", {
    dx: 0,
    dy: 0,
    distance: null,
}, {
    validate(rec) {
        const dxOk = Number.isFinite(rec.dx);
        const dyOk = Number.isFinite(rec.dy);
        const distOk = rec.distance == null || (Number.isFinite(rec.distance) && rec.distance >= 0);
        return dxOk && dyOk && distOk;
    }
});