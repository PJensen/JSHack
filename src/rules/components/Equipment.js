import { defineComponent } from "../../lib/ecs-js/index.js";

export const Equipment = defineComponent('Equipment', {
  weapon: null,
  armor: null,
  shield: null,
  ring1: null,
  ring2: null,
  attackDerived: 0,
  defenseDerived: 0,
  maxHpDerived: 0,
  critChanceDerived: 0,
  critMultDerived: 0,
  naturalDamageDice: null
});