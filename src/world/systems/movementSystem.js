// Movement System
// Processes InputIntent and updates Position for entities that want to move
import { Position } from '../components/Position.js';
import { InputIntent } from '../components/InputIntent.js';
import { Player } from '../components/Player.js';
import { Tile } from '../components/Tile.js';
import { Occluder } from '../components/Occluder.js';
import { Collider } from '../components/Collider.js';
import { MapView } from '../components/MapView.js';
import { Monster } from '../components/Monster.js';
import { Health } from '../components/Health.js';
import { MeleeAttack } from '../components/MeleeAttack.js';

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
  let blockedByEntity = null;
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
            // Tile exists and is walkable: also check entity colliders at destination
            for (const [bid, bpos] of world.query(Position)) {
              if (bid === id) continue;
              if (bpos.x === nx && bpos.y === ny) {
                const c = world.get(bid, Collider);
                if (c && c.solid === true) { blocked = true; blockedByEntity = bid; break; }
                const t = world.get(bid, Tile);
                if (t && t.walkable === false) { blocked = true; break; }
                const o = world.get(bid, Occluder);
                if (o && (o.opacity ?? 1) > 0.5) { blocked = true; break; }
              }
            }
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
            // otherwise walkable (including '·', '🚪', '^', '>'); still check entity colliders
            for (const [bid, bpos] of world.query(Position)) {
              if (bid === id) continue;
              if (bpos.x === nx && bpos.y === ny) {
                const c = world.get(bid, Collider);
                if (c && c.solid === true) { blocked = true; blockedByEntity = bid; break; }
                const t = world.get(bid, Tile);
                if (t && t.walkable === false) { blocked = true; break; }
                const o = world.get(bid, Occluder);
                if (o && (o.opacity ?? 1) > 0.5) { blocked = true; break; }
              }
            }
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
            if (c && c.solid === true) { blocked = true; blockedByEntity = bid; break; }
            const o = world.get(bid, Occluder);
            if (o && (o.opacity ?? 1) > 0.5) { blocked = true; break; }
          }
        }
      }

      if (!blocked) {
        world.set(id, Position, { x: nx, y: ny });
      } else if (blockedByEntity != null) {
        // If the mover is the Player and the blocking entity is a Monster or has Health, enqueue a melee attack
        const isPlayer = !!world.get(id, Player);
        if (isPlayer) {
          const isMonster = !!world.get(blockedByEntity, Monster);
          const hasHealth = !!world.get(blockedByEntity, Health);
          if (isMonster || hasHealth) {
            try {
              const atkEnt = world.create();
              world.add(atkEnt, MeleeAttack, { attacker: id, target: blockedByEntity, x: nx, y: ny });
            } catch(_) { /* ignore if creation fails */ }
          }
        }
      }
      // One-shot movement: clear intent whether or not we moved
      world.set(id, InputIntent, { dx: 0, dy: 0 });
    }
  }
}
