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
      // Prefer MapView tile data (walkable) from the designated MapView; fallback to glyphs/entities
      let blocked = false;
      outer: {
        // Select primary MapView if registered
        let mv = null;
        try {
          const mvId = world.mapViewId;
          if (mvId) mv = world.get(mvId, MapView);
          if (!mv) {
            for (const [_id, _mv] of world.query(MapView)) { mv = _mv; break; }
          }
        } catch (_) { /* ignore */ }

        if (mv) {
          // 1) Tile-based walkability
          const tileAt = mv.tileAt;
          if (typeof tileAt === 'function') {
            const tile = tileAt(nx, ny);
            // Out-of-bounds or missing tile: treat as blocked (void)
            if (!tile) { blocked = true; break outer; }
            if (tile.walkable === false) { blocked = true; break outer; }
            // Tile exists and is walkable: done (no need to scan entities)
            break outer;
          }
          // 2) Fallback to glyph-based blocking if provided
          const glyphAt = mv.glyphAt;
          if (typeof glyphAt === 'function') {
            const g = glyphAt(nx, ny) || '';
            if (g === '') { blocked = true; break outer; } // void/out-of-bounds
            // Walls and certain features block movement
            if (g === '█' || g === '≈' || g === '⛲' || g === '🕳' || g === '⎈' || g === '♛' || g === '†') {
              blocked = true; break outer;
            }
            // otherwise walkable (including '·', '🚪', '^', '>')
            break outer;
          }
          // If this MapView doesn't expose tile/glyph, fall through to entity scan
        }

        // 3) Fallback: scan entities at destination
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
