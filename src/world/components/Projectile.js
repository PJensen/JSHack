// Projectile.js
// ECS Component: Projectile properties for moving ephemeral entities
import { defineComponent } from '../../lib/ecs/core.js';

export const Projectile = defineComponent('Projectile', {
  vx: 0,       // velocity x (tiles per second)
  vy: 0,       // velocity y (tiles per second)
  speed: 0     // optional speed magnitude override
});
