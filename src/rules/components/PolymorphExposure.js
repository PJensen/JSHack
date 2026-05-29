import { defineComponent } from "../../lib/ecs-js/index.js";
import { clamp } from "../../shared/math/math.js";

/**
 * Short-term adaptation from repeated polymorph pressure on the same target.
 * This is scalar runtime state, not a list of attempts: repeated failures make
 * the current form harder to force until the entity is transformed or removed.
 */
export const PolymorphExposure = defineComponent(
  "PolymorphExposure",
  {
    attempts: 0,
    resistanceBonus: 0,
    maxBonus: 0.5,
    lastOutcome: "",
    lastSource: "",
  },
  {
    validate(rec) {
      if (!rec || typeof rec !== "object") return false;
      rec.attempts = Math.max(0, Number(rec.attempts || 0) | 0);
      rec.resistanceBonus = clamp(Number(rec.resistanceBonus || 0), 0, 1);
      rec.maxBonus = clamp(Number(rec.maxBonus ?? 0.5), 0, 1);
      rec.lastOutcome = String(rec.lastOutcome || "");
      rec.lastSource = String(rec.lastSource || "");
      return true;
    },
  },
);

