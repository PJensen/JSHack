import { defineComponent } from "../../lib/ecs-js/index.js";
import { clamp } from "../../shared/math/math.js";

export const POLYMORPH_FAILURE_MODES = Object.freeze([
  "normal",
  "resist",
  "fumble",
  "volatile",
]);

/**
 * Runtime polymorph policy hooks for entities whose transform behavior is not
 * fully described by monster authoring data.
 *
 * resistance: chance from 0.0 to 1.0 that the entity rejects a polymorph
 * attempt before any transformation happens. Example: 0.8 means an 80% resist
 * chance before control/power modifiers.
 *
 * stability: integer-ish body coherence rating, not a percent.
 *   0 = unstable/malleable
 *   1 = ordinary living body
 *   2 = anchored supernatural, ancient, or constructed form
 *   3+ = exceptional plot/boss/warded coherence
 * Higher values make messy failure less likely and push policy toward clean
 * resistance rather than accidental forms or volatile side effects.
 *
 * failureMode: preferred style when this profile causes or shapes a failure.
 * "normal" lets policy choose; "resist" favors no transformation; "fumble"
 * favors a wrong-but-valid form; "volatile" is reserved for side effects.
 */
export const PolymorphProfile = defineComponent(
  "PolymorphProfile",
  {
    resistance: 0,
    stability: 0,
    failureMode: "normal",
  },
  {
    validate(rec) {
      if (!rec || typeof rec !== "object") return false;
      rec.resistance = clamp(Number(rec.resistance || 0), 0, 1);
      rec.stability = Math.max(0, Number(rec.stability || 0));
      rec.failureMode = POLYMORPH_FAILURE_MODES.includes(String(rec.failureMode || ""))
        ? String(rec.failureMode)
        : "normal";
      return true;
    },
  },
);
