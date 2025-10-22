// Latch.js
// ECS Component: generic latch/lock/armed state for things that can be toggled or unlocked
import { defineComponent } from '../../lib/ecs/core.js';

export const Latch = defineComponent('Latch', {
  armed: true,           // whether the latch is currently engaged
  requiresKey: null,     // optional key id or tool required to toggle
  difficulty: 0          // generic difficulty (could be used for forcible opening)
});
