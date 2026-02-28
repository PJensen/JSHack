// Stamina.js
// ECS Component: Stamina pool and regen for physical actions
import { defineComponent } from "../../lib/ecs-js/index.js";

export const Stamina = defineComponent('Stamina', {
  maxStamina: 100,
  stamina: 100,
  staminaRegen: 3.0,
  regenCooldown: 0,
});
