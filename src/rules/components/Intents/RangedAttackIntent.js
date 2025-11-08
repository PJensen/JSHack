import { defineComponent } from "../../../lib/ecs-js/index.js";

// Intent to perform a ranged attack using the equipped ranged weapon (e.g., bow)
export const RangedAttackIntent = defineComponent('RangedAttackIntent', {
  targetId: 0,   // optional explicit target
  toX: 0,        // optional aim point x
  toY: 0,        // optional aim point y
});
