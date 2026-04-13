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
    corrosionStacks: 0,
    waterloggedStacks: 0,
    soggyStacks: 0,
    swollenStacks: 0,
    dilutedStacks: 0,
    ruinedByWater: false,
    soot: 0,
    burning: false,
    brittleBonus: 0,
  },
  {
    validate(rec) {
      const numericKeys = [
        "wetness",
        "heatC",
        "corrosion",
        "corrosionStacks",
        "waterloggedStacks",
        "soggyStacks",
        "swollenStacks",
        "dilutedStacks",
        "soot",
        "brittleBonus",
      ];
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
      if (typeof rec?.ruinedByWater !== "boolean") {
        throw new Error("MaterialState.validate(): ruinedByWater must be boolean");
      }
      return true;
    },
  }
);
