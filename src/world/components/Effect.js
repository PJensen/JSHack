// Effect.js
// ECS Component: Visual or status effect instance
import { defineComponent } from '../../lib/ecs/core.js';

export const Effect = defineComponent('Effect', {
  type: '',
  duration: 0,
  data: null
});
