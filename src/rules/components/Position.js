import { defineComponent } from "../../lib/ecs-js/index.js";
/**
 * Position component representing 2D coordinates in continuous space.
 */
export const Position = defineComponent(
  "Position",
  { x: 0, y: 0 },
  {
    validate(rec) {
      if (!Number.isFinite(rec.x) || !Number.isFinite(rec.y)) {
        throw new Error(
          `Position: coordinates must be finite numbers (x=${rec.x}, y=${rec.y})`
        );
      }
      return true;
    }
  }
);
