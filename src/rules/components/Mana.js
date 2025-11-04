// Mana.js
// ECS Component: Mana pool and regen
import { defineComponent } from "../../lib/ecs-js/index.js";

export const Mana = defineComponent('Mana', {
  maxMana: 50,
  mana: 50,
  manaRegen: 1
});