import { defineComponent } from "../../../lib/ecs-js/index.js";

export const RangedAttackIntent = defineComponent('RangedAttackIntent', {
  targetId: 0,
  toX: 0,
  toY: 0,
});
