import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Mutable per-entity material exposure state.
 * Intrinsic properties stay in data/materials.js.
 */
export const MaterialState = defineComponent(
  "MaterialState",
  {
    primary: "",
    wetness: 0,
    heatC: 20,
    corrosion: 0,
    soot: 0,
    burning: false,
    brittleBonus: 0,
  },
  {
    validate(rec) {
      const numericKeys = ["wetness", "heatC", "corrosion", "soot", "brittleBonus"];
      for (const key of numericKeys) {
        if (!Number.isFinite(Number(rec?.[key]))) {
          throw new Error(`MaterialState.validate(): ${key} must be finite`);
        }
      }
      if (typeof rec?.primary !== "string") {
        throw new Error("MaterialState.validate(): primary must be a string");
      }
      if (typeof rec?.burning !== "boolean") {
        throw new Error("MaterialState.validate(): burning must be boolean");
      }
      return true;
    },
  }
);
