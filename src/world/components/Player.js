// Player.js
// ECS Component: Player marker and player-specific data
import { defineComponent } from '../../lib/ecs/core.js';

export const Player = defineComponent('Player', {
  gold: 0,
  name: 'Hero',
  spells: [], // array of spell ids
  activeSpellIndex: -1
});
