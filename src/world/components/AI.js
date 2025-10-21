// AI.js
// ECS Component: AI type/behavior
import { defineComponent } from '../../lib/ecs/core.js';

export const AI = defineComponent('AI', {
  type: null // e.g. 'basic', 'ranged', etc.
});
