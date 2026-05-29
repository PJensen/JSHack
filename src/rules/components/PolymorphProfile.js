import { defineComponent } from "../../lib/ecs-js/index.js";
import { clamp } from "../../shared/math/math.js";

export const POLYMORPH_STABILITY = Object.freeze({
  unstable: "unstable",
  ordinary: "ordinary",
  anchored: "anchored",
  fixed: "fixed",
});

export const POLYMORPH_STABILITY_SCORE = Object.freeze({
  [POLYMORPH_STABILITY.unstable]: 0,
  [POLYMORPH_STABILITY.ordinary]: 1,
  [POLYMORPH_STABILITY.anchored]: 2,
  [POLYMORPH_STABILITY.fixed]: 3,
});

export const POLYMORPH_FAILURE_MODES = Object.freeze([
  "normal",
  "resist",
  "fumble",
  "volatile",
]);

/**
 * @param {any} value
 * @returns {string}
 */
export function normalizePolymorphStability(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(POLYMORPH_STABILITY_SCORE, raw)) return raw;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    if (numeric <= 0) return POLYMORPH_STABILITY.unstable;
    if (numeric <= 1) return POLYMORPH_STABILITY.ordinary;
    if (numeric <= 2) return POLYMORPH_STABILITY.anchored;
    return POLYMORPH_STABILITY.fixed;
  }
  return POLYMORPH_STABILITY.ordinary;
}

/**
 * @param {any} value
 * @returns {number}
 */
export function polymorphStabilityScore(value) {
  return POLYMORPH_STABILITY_SCORE[normalizePolymorphStability(value)] ?? POLYMORPH_STABILITY_SCORE.ordinary;
}

/**
 * Runtime polymorph policy hooks for entities whose transform behavior is not
 * fully described by monster authoring data.
 *
 * resistance: chance from 0.0 to 1.0 that the entity rejects a polymorph
 * attempt before any transformation happens. Example: 0.8 means an 80% resist
 * chance before control/power modifiers.
 *
 * stability: serialized body coherence enum, not a percent.
 *   "unstable" = unstable/malleable
 *   "ordinary" = ordinary living body
 *   "anchored" = anchored supernatural, ancient, or constructed form
 *   "fixed" = exceptional plot/boss/warded coherence
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
    stability: POLYMORPH_STABILITY.ordinary,
    failureMode: "normal",
  },
  {
    validate(rec) {
      if (!rec || typeof rec !== "object") return false;
      rec.resistance = clamp(Number(rec.resistance || 0), 0, 1);
      rec.stability = normalizePolymorphStability(rec.stability);
      rec.failureMode = POLYMORPH_FAILURE_MODES.includes(String(rec.failureMode || ""))
        ? String(rec.failureMode)
        : "normal";
      return true;
    },
  },
);
