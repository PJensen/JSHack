// InputIntent.js
// ECS Component: Encodes the immediate input intent for an entity (e.g., player)
import { defineComponent } from '../../lib/ecs/core.js';

export const InputIntent = defineComponent('InputIntent', {
  dx: 0,    // desired movement delta x (tiles)
  dy: 0,    // desired movement delta y (tiles)
  action: null // optional action string (e.g., 'use', 'attack')
});
