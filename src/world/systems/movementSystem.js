// Movement System
// Processes InputIntent and updates Position for entities that want to move
import { Position } from '../components/Position.js';
import { InputIntent } from '../components/InputIntent.js';
import { Player } from '../components/Player.js';
import { Tile } from '../components/Tile.js';
import { Occluder } from '../components/Occluder.js';
import { Collider } from '../components/Collider.js';
import { MapView } from '../components/MapView.js';

export function movementSystem(world) {
  // Process all entities with Position and InputIntent
  for (const [id, pos, intent] of world.query(Position, InputIntent)) {
    // If there's movement intent, update position
    if (intent.dx !== 0 || intent.dy !== 0) {
      const nx = pos.x + intent.dx;
      const ny = pos.y + intent.dy;

      // Check for blocking at destination
      // Fast path: MapView walkability by glyph
      let blocked = false;
      outer: {
        for (const [mvid, mv] of world.query(MapView)){
          const glyphAt = mv && mv.glyphAt;
          if (typeof glyphAt !== 'function') break;
          const g = glyphAt(nx, ny) || '';
          // Treat common glyphs: walls and certain features block, doors/traps/stairs/floors allow
          // Glyphs from dungeonGeneratorSystem: '█','·','🚪','≈','^','⛲','🕳','⎈','♛','†','>'
          if (g === '█' || g === '≈' || g === '⛲' || g === '🕳' || g === '⎈' || g === '♛' || g === '†') {
            blocked = true; break outer;
          }
          // otherwise walkable (including '·', '🚪', '^', '>')
          break outer;
        }
        // Fallback: scan entities at destination
        for (const [bid, bpos] of world.query(Position)) {
          if (bid === id) continue; // don't collide with self
          if (bpos.x === nx && bpos.y === ny) {
            const t = world.get(bid, Tile);
            if (t && t.walkable === false) { blocked = true; break; }
            const c = world.get(bid, Collider);
            if (c && c.solid === true) { blocked = true; break; }
            const o = world.get(bid, Occluder);
            if (o && (o.opacity ?? 1) > 0.5) { blocked = true; break; }
          }
        }
      }

      if (!blocked) {
        world.set(id, Position, { x: nx, y: ny });
      }
      // One-shot movement: clear intent whether or not we moved
      world.set(id, InputIntent, { dx: 0, dy: 0 });
    }
  }
}
