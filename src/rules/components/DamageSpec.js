import { defineComponent } from "../../lib/ecs-js/index.js";

// DamageSpec — a simple accumulator for immediate damage channels
// Example channel: { type:'poison', amount: number }
export const DamageSpec = defineComponent("DamageSpec", {
  channels: [],
});
