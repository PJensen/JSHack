import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Facing — forward unit vector used for movement/FOV queries.
 */
export const Facing = defineComponent(
  "Facing",
  { x: 1, y: 0 },
  {
    validate(rec) {
      if (!Number.isFinite(rec.x) || !Number.isFinite(rec.y)) {
        throw new Error(`Facing components must be finite numbers (x=${rec.x}, y=${rec.y})`);
      }
      const mag = Math.hypot(rec.x, rec.y);
      if (mag === 0) {
        throw new Error("Facing vector must be non-zero");
      }
      return true;
    }
  }
);
