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
import { Door } from '../components/Door.js';
import { Glyph } from '../components/Glyph.js';
import { Interactable } from '../components/Interactable.js';

export function movementSystem(world) {
  // To prevent same-tick stacking when component updates are deferred until post-tick,
  // reserve destinations we approve this frame. Monsters cannot enter tiles already
  // reserved by other monsters in this system run.
  const reservedMonster = new Set(); // keys: "x,y"

  // Process all entities with Position and InputIntent
  for (const [id, pos, intent] of world.query(Position, InputIntent)) {
    // If there's movement intent, update position
    if (intent.dx !== 0 || intent.dy !== 0) {
      const nx = pos.x + intent.dx;
      const ny = pos.y + intent.dy;
      const destKey = nx + ',' + ny;

      // Check for blocking at destination
      // First: handle Door ECS entities at the destination (consume turn to open if closed)
      // Then: Prefer MapView tile data for general walkability; fallback to glyphs/entities
  let blocked = false;
  let blockedByEntity = null;
      const moverIsMonster = !!world.get(id, Monster);
      outer: {
        // Same-tick reservation check: monsters cannot target an already claimed tile
        if (!!world.get(id, Monster) && reservedMonster.has(destKey)) {
          blocked = true; // someone already claimed this tile this tick
          break outer;
        }
        // Quick door check via ECS entities
        for (const [did, dpos, d] of world.query(Position, Door)){
          if ((dpos.x|0) === (nx|0) && (dpos.y|0) === (ny|0)){
            // Found a door entity at destination
            if (d && d.state !== 'open'){
              // Open the door: update Door, Collider, Glyph and MapView tile (if present)
              try { world.set(did, Door, { state: 'open' }); } catch(_){}
              try { world.set(did, Collider, { solid: false, blocksSight: false }); } catch(_){}
              try { world.set(did, Glyph, { char: '/', fg: '#8b4513', color: '#8b4513' }); } catch(_){}
              // Sync MapView tile representation for renderers depending on tiles
              try{
                let mv = null; const mvId = world.mapViewId; if (mvId) mv = world.get(mvId, MapView);
                if (!mv){ for (const [_id,_mv] of world.query(MapView)){ mv = _mv; break; } }
                const tileAt = mv && mv.tileAt;
                if (typeof tileAt === 'function'){
                  const t = tileAt(nx, ny);
                  if (t){ t.state = 'open'; t.walkable = true; t.blocksLight = false; t.glyph = '/'; }
                }
              }catch(_){}
              blocked = true; // consume this turn to open
              break outer;
            }
            // If already open, ensure it doesn't block
            try{ const c = world.get(did, Collider); if (c){ c.solid = false; c.blocksSight = false; } }catch(_){}
            break; // continue into tile checks (should pass walkable)
          }
        }

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
            // If this is a closed door tile but no door entity was found, open the tile (legacy fallback)
            if (tile.type === 'door' && (tile.state !== 'open')) {
              tile.state = 'open';
              tile.walkable = true;
              tile.blocksLight = false;
              tile.glyph = '/';
              blocked = true; // consume the turn to open
              break outer;
            }
            if (tile.walkable === false) { blocked = true; break outer; }
            // Tile exists and is walkable: also check entity colliders at destination
            for (const [bid, bpos] of world.query(Position)) {
              if (bid === id) continue;
              if (bpos.x === nx && bpos.y === ny) {
                const c = world.get(bid, Collider);
                // Monsters cannot stack: any monster blocks other monsters regardless of Collider
                if (moverIsMonster && !!world.get(bid, Monster)) { blocked = true; blockedByEntity = bid; break; }
                if (c && c.solid === true) { blocked = true; blockedByEntity = bid; break; }
                const t = world.get(bid, Tile);
                if (t && t.walkable === false) { blocked = true; break; }
                const o = world.get(bid, Occluder);
                if (o && (o.opacity ?? 1) > 0.5) { blocked = true; break; }
              }
            }
            break outer;
          }
          // 2) Fallback to glyph-based blocking if provided (legacy)
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
                // Monsters cannot stack: any monster blocks other monsters regardless of Collider
                if (moverIsMonster && !!world.get(bid, Monster)) { blocked = true; blockedByEntity = bid; break; }
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
            // Monsters cannot stack: any monster blocks other monsters regardless of Collider
            if (moverIsMonster && !!world.get(bid, Monster)) { blocked = true; blockedByEntity = bid; break; }
            if (c && c.solid === true) { blocked = true; blockedByEntity = bid; break; }
            const o = world.get(bid, Occluder);
            if (o && (o.opacity ?? 1) > 0.5) { blocked = true; break; }
          }
        }
      }

      if (!blocked) {
        world.set(id, Position, { x: nx, y: ny });
        // Record reservation so later monsters in this pass can't claim same tile
        if (moverIsMonster) reservedMonster.add(destKey);
      } else if (blockedByEntity != null) {
        // If mover is Player or Monster and target is attackable, enqueue a melee attack
        const isPlayer = !!world.get(id, Player);
        const isMonsterMover = !!world.get(id, Monster);
        const targetIsMonster = !!world.get(blockedByEntity, Monster);
        const targetHasHealth = !!world.get(blockedByEntity, Health);
        if ((isPlayer && (targetIsMonster || targetHasHealth)) || (isMonsterMover && targetHasHealth)) {
          try {
            const atkEnt = world.create();
            world.add(atkEnt, MeleeAttack, { attacker: id, target: blockedByEntity, x: nx, y: ny });
          } catch(_) { /* ignore if creation fails */ }
        }
      }
      // One-shot movement: clear intent whether or not we moved
      world.set(id, InputIntent, { dx: 0, dy: 0 });
    }
  }
}
