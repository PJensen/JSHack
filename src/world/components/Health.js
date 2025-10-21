// Health.js
// ECS Component: Health pool
import { defineComponent } from '../../lib/ecs/core.js';

export const Health = defineComponent('Health', {
  maxHp: 1,
  hp: 1
});
