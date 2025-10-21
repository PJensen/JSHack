// Spell.js
// ECS Component: Learned spell
import { defineComponent } from '../../lib/ecs/core.js';

export const Spell = defineComponent('Spell', {
  id: null,
  name: '',
  cost: 0,
  cast: null // function or reference
});
