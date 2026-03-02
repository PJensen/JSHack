// ItemCooldown.js
// ECS Component: per-item use cooldown
import { defineComponent } from "../../lib/ecs-js/index.js";

export const ItemCooldown = defineComponent('ItemCooldown', {
  turnsRemaining: 0,
  turnsMax: 0,
});
