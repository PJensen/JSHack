// Collider.js
// ECS Component: Collision properties for an entity
import { defineComponent } from '../../lib/ecs/core.js';

export const Collider = defineComponent('Collider', {
  solid: true,       // blocks movement if true
  blocksSight: false // line of sight blocking
});
