// teleportSystem.js
// Skeleton system to process DungeonLevelLink activations.
import { Position } from '../components/Position.js';
import { DungeonLevelLink } from '../components/DungeonLevelLink.js';
import { Latch } from '../components/Latch.js';
import { DungeonLevelLink } from '../components/DungeonLevelLink.js';

export function teleportSystem(world) {
  // Query entities that have a link and a position. Triggering logic (step or interact)
  // is omitted here; systems producing trigger events should mark entities or call
  // a function to activate the link. This skeleton demonstrates the canonical
  // operations: check latch, compute destination, and set Position.

  for (const [id, pos, link] of world.query(Position, DungeonLevelLink)) {
    // Placeholder: in real use we only run when triggered (player stepped or activated)
    // For demonstration, skip entities with no destination
    if (!link.destinationLevelId) continue;

    // Respect Latch if present
    if (world.has(id, Latch) && world.get(id, Latch).armed) continue;

    // Determine destination position
    const dest = link.destinationPosition;
    if (!dest) {
      // fallback: system should choose a spawn on destination level.
      // Here we just skip since level resolution is game-specific.
      continue;
    }


    // Move entity to destination position. If your world tracks current level
    // separately (not shown here), set that as well.
    world.set(id, Position, { x: dest.x, y: dest.y });

    // Update traversal count on the link itself
    world.set(id, DungeonLevelLink, { traversed: (link.traversed||0) + 1 });

    // Optionally: run scriptRef, emit events, handle oneWay links, etc.
  }
}
