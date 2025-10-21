// Score.js
// Defines the Score component for ECS
import { defineComponent } from '../../lib/ecs/core.js';

export const Score = defineComponent('Score', {
  current: 0,
  best: 0,
  lastDeathDepth: 0,
  runs: 0
});
