// Dead.js
// ECS Component: Dead marker
import { defineComponent } from '../../lib/ecs/core.js';

export const Dead = defineComponent('Dead', {
  dead: false
});
