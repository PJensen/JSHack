// Affix.js
// ECS Component: Item affixes
import { defineComponent } from '../../lib/ecs/core.js';

export const Affix = defineComponent('Affix', {
  affixes: [] // array of affix keys or objects
});
