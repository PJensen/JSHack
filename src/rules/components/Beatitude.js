import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Beatitude — BUC state for bless/uncurse/curse mechanics.
 * Default assumption when absent is uncursed.
 */
/** Beatitude state constants for use in systems that need to avoid literal strings. */
export const BUC_CURSED = "cursed";
export const BUC_BLESSED = "blessed";
export const BUC_UNCURSED = "uncursed";

export const Beatitude = defineComponent(
  "Beatitude",
  {
    state: "uncursed", // blessed|uncursed|cursed
  },
  {
    validate(rec) {
      const state = String(rec?.state || "uncursed").toLowerCase();
      if (state !== "blessed" && state !== "uncursed" && state !== "cursed") {
        throw new Error("Beatitude.validate(): state must be blessed|uncursed|cursed");
      }
      rec.state = state;
      return true;
    },
  },
);
