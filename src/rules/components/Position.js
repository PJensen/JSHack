import { defineComponent } from "../../lib/ecs-js/index.js";
/**
 * Position component representing 2D (integer) coordinates.
 */
export const Position = defineComponent(
  "Position",
  { x: 0, y: 0 },
  {
    validate(rec) {
      if (!Number.isInteger(rec.x) || !Number.isInteger(rec.y)) {
        throw new Error(
          `Position: coordinates must be integers (x=${rec.x}, y=${rec.y})`
        );
      }
      return true;
    }
  }
);
