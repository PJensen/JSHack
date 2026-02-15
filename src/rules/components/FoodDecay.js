import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * FoodDecay — tracks food rot over time while held in inventory.
 * @property {number} turnsHeld - turns this food has spent in an inventory (incremented by foodDecaySystem)
 * @property {number} shelfLife - turns until fully putrid (e.g. 500 for rations, 150 for corpses)
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
      if (!Number.isFinite(rec.shelfLife) || rec.shelfLife < 1)
        throw new Error("FoodDecay.validate(): shelfLife must be a positive number");
      return true;
    },
  }
);
