import { defineComponent } from "../../lib/ecs-js/index.js";

export const Equipment = defineComponent('Equipment', {
  weapon: null,
  armor: null,
  shield: null,
  ring1: null,
  ring2: null,
  ammo: null,
  attackDerived: 0,
  defenseDerived: 0,
  maxHpDerived: 0,
  critChanceDerived: 0,
  critMultDerived: 0,
  manaRegenDerived: 0,
  staminaRegenDerived: 0,
  maxStaminaDerived: 0,
  kineticDRDerived: 0,
  fireResistDerived: 0,
  poisonResistDerived: 0,
  acidResistDerived: 0,
  radiationResistDerived: 0,
  electricOhmsDerived: 0,
  bluntResistDerived: 0,
  slashResistDerived: 0,
  pierceResistDerived: 0,
  naturalDamageDice: null,
  naturalScript: null
});
