import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Rules-side configuration state for facing behavior.
 */
export const FacingRules = defineComponent("FacingRules", {
  turnCostEnabled: false,
}, {
  validate(rec) {
    /** @type {any} */
    const r = /** @type any */ (rec);
    if (typeof r.turnCostEnabled !== "boolean") throw new Error("FacingRules.turnCostEnabled must be boolean");
    return true;
  },
});

