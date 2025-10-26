// Door.js
// ECS Component: Door state and properties
import { defineComponent } from '../../lib/ecs/core.js';

export const Door = defineComponent('Door', {
  state: 'closed', // 'closed' | 'open'
  locked: false,
  orientation: null // 'h' | 'v' | null
});
