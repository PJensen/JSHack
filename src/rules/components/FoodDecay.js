import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * FoodDecay — tracks food rot over time while held in inventory.
 * @property {number} turnsHeld - turns this food has spent in an inventory (incremented by foodDecaySystem)
 * @property {number|string} shelfLife - turns or expression until fully putrid; 0 means never decays
 */
export const FoodDecay = defineComponent(
  "FoodDecay",
  {
    turnsHeld: 0,
    shelfLife: 300,
  },
  {
    validate(rec) {
      if (!Number.isFinite(rec.turnsHeld) || rec.turnsHeld < 0)
        throw new Error("FoodDecay.validate(): turnsHeld must be a non-negative number");
      if (typeof rec.shelfLife === "number" && (!Number.isFinite(rec.shelfLife) || rec.shelfLife < 0))
        throw new Error("FoodDecay.validate(): numeric shelfLife must be >= 0");
      if (typeof rec.shelfLife !== "number" && typeof rec.shelfLife !== "string")
        throw new Error("FoodDecay.validate(): shelfLife must be a number or expression string");
      return true;
    },
  }
);
