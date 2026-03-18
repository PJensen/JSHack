import { defineComponent } from "../../lib/ecs-js/index.js";

export const BaseStats = defineComponent("BaseStats", {
  strength: 0,
  intelligence: 0,
  dexterity: 0,
  vitality: 0,
  staminaRegen: 0,
  critChance: 0,
  critMultiplier: 1.5,
  baseDamageMin: 0,
  baseDamageMax: 0,
  perception: 5,
});
