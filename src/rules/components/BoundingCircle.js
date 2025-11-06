import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * BoundingCircle — continuous collider radius for analytic world queries.
 */
export const BoundingCircle = defineComponent(
  "BoundingCircle",
  { radius: 0.5 },
  {
    validate(rec) {
      if (!Number.isFinite(rec.radius) || rec.radius < 0) {
        throw new Error(`BoundingCircle.radius must be >= 0 (got ${rec.radius})`);
      }
      return true;
    }
  }
);
