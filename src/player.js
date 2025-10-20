import { defineComponent } from './ecs/core.js';

// Player component definitions
// Position: tile coordinates (integers)
export const Position = defineComponent('Position', { x: 0, y: 0 });

// Player tag/marker component (can hold metadata later)
export const Player = defineComponent('Player', { name: 'Player' });

// Spawn helper: creates an entity with Position and Player components
export function spawnPlayer(world, x = 0, y = 0){
  const id = world.create();
  world.add(id, Position, { x: Math.floor(x), y: Math.floor(y) });
  world.add(id, Player, { name: (Player.name || 'Player') });
  return id;
}
