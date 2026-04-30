import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * EquippedSlotNode marks a runtime equipment slot in actor topology.
 */
export const EquippedSlotNode = defineComponent("EquippedSlotNode", {
  slot: "",
});
