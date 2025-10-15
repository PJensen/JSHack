import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Owner component for tracking entity ownership.
 * @property {string} ownerId - The ID of the owning entity (e.g., player, container).
 */
export const Owner = defineComponent(
  "Owner",
  {
    ownerId: null
  },
  {
    validate(rec) {
      // Accept number (entity id) or non-empty string
      return (
        (typeof rec.ownerId === "number" && Number.isFinite(rec.ownerId) && rec.ownerId >= 0) ||
        (typeof rec.ownerId === "string" && rec.ownerId.length > 0)
      );
    }
  }
);
