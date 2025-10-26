// TurnState.js
// ECS Component: Singleton tracking whose turn it is and round count.
import { defineComponent } from '../../lib/ecs/core.js';

// phase: 'player' or 'monsters'
export const TurnState = defineComponent('TurnState', {
  phase: 'player',
  round: 1
});

export default TurnState;
