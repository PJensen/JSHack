import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * TimedEffectNode marks an attached runtime effect with a ticking lifecycle.
 *
 * Put timing values on Duration so lifetime can be shared by statuses,
 * enchantments, hazards, and other runtime topology nodes.
 */
export const TimedEffectNode = defineComponent("TimedEffectNode", {
  key: "",
});
