import { defineComponent } from "../../lib/ecs-js/index.js";

export const COMBAT_POSTURES = Object.freeze({
  balanced: "balanced",
  aggressive: "aggressive",
  guarded: "guarded",
});

export const CombatPosture = defineComponent("CombatPosture", {
  stance: COMBAT_POSTURES.balanced,
  lastChangedStep: 0,
  lastMoveStep: -1,
}, {
  validate(rec) {
    const stance = String(rec?.stance || COMBAT_POSTURES.balanced).toLowerCase();
    if (!Object.values(COMBAT_POSTURES).includes(stance)) {
      throw new Error(`CombatPosture.stance invalid: ${stance}`);
    }
    return true;
  },
});
