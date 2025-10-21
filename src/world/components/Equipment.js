// Equipment.js
// ECS Component: Equipment slots and derived stats
import { defineComponent } from '../../lib/ecs/core.js';

export const Equipment = defineComponent('Equipment', {
  weapon: null,
  armor: null,
  ring1: null,
  ring2: null,
  attackDerived: 0,
  defenseDerived: 0,
  maxHpDerived: 0,
  critChanceDerived: 0,
  critMultDerived: 0
});
