import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Wounds — simple aggregate of wound records applied to an entity.
 * Shape: { list: Array<Wound> }
 * Wound is a plain object produced by resolver systems (see smoke-test.js).
 */
export const Wounds = defineComponent(
  "Wounds",
  { list: [] },
  {
    validate(rec) {
      if (!rec || !Array.isArray(rec.list)) throw new Error("Wounds.list must be an array");
      return true;
    },
  }
);
