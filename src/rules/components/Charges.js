import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Charges stores consumable charge state on the runtime node that owns it.
 */
export const Charges = defineComponent("Charges", {
  current: 0,
  max: 0,
});
