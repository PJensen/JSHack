// Movement System
// Processes InputIntent and updates Position for entities that want to move
import { Position } from '../components/Position.js';
import { InputIntent } from '../components/InputIntent.js';
import { Player } from '../components/Player.js';

export function movementSystem(world) {
  // Process all entities with Position and InputIntent
  for (const [id, pos, intent] of world.query(Position, InputIntent)) {
    // If there's movement intent, update position
    if (intent.dx !== 0 || intent.dy !== 0) {
      console.log(`Movement: (${pos.x},${pos.y}) -> (${pos.x + intent.dx},${pos.y + intent.dy}), intent=(${intent.dx},${intent.dy})`);
      world.set(id, Position, {
        x: pos.x + intent.dx,
        y: pos.y + intent.dy
      });
    }
  }
}
