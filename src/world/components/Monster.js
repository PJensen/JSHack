import { defineComponent } from '../../lib/ecs/core.js';

// Monster component for ECS: marks an entity as a monster and can hold monster-specific data
export const Monster = defineComponent('Monster', {
  ai: null // e.g., 'basic', 'boss', etc. (optional, can be extended later)
});
