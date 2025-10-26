// monsterSpawnSystem.js
// Spawns a handful of monsters after dungeon level generation using MONSTER_DEFS

import { DungeonLevel } from '../components/DungeonLevel.js';
import { MapView } from '../components/MapView.js';
import { Position } from '../components/Position.js';
import { MonsterArchetype } from '../archetypes/MonsterArchetype.js';
import { createDeferred } from '../../lib/ecs/archetype.js';
import { MONSTER_DEFS } from '../data/monster-defs.js';

function sample(world){ try { return typeof world.rand === 'function' ? world.rand() : Math.random(); } catch(_) { return Math.random(); } }

export function monsterSpawnSystem(world){
  // Need a map and a generated dungeon level with spawn
  let mv = null; const mvId = world.mapViewId | 0;
  try { if (mvId) mv = world.get(mvId, MapView); } catch(_) {}
  if (!mv){ for (const [id, _mv] of world.query(MapView)){ mv = _mv; break; } }
  if (!mv || !mv.tileAt) return;

  for (const [lid, lvl] of world.query(DungeonLevel)){
    if (!lvl?.generated) continue;
    if (lvl._monstersSpawned) continue;

    const w = mv.w | 0, h = mv.h | 0;
    if (!w || !h) continue;

    // Decide count from map size but keep it modest for perf; prefer 8..16
    const area = Math.max(1, w * h);
    const base = Math.max(8, Math.min(16, Math.floor(area / 400)));
    const jitter = (sample(world) * 5) | 0;
    const count = base + jitter;

    const avoid = { x: lvl.spawn?.x | 0, y: lvl.spawn?.y | 0 };
    const avoidRadius = 4;
    const isNearSpawn = (x,y)=> Math.abs(x - avoid.x) + Math.abs(y - avoid.y) <= avoidRadius;

    // Place monsters only on walkable tiles, not on spawn, and not overlapping solids
    const used = new Set();
    const key = (x,y)=> x + ',' + y;

    let placed = 0; let attempts = 0; const MAX_ATTEMPTS = count * 40;
    while (placed < count && attempts < MAX_ATTEMPTS){
      attempts++;
      const x = (sample(world) * w) | 0;
      const y = (sample(world) * h) | 0;
      const t = mv.tileAt(x, y);
      if (!t || t.walkable === false) continue;
      if (isNearSpawn(x,y)) continue;
      const k = key(x,y); if (used.has(k)) continue;
      // Avoid overlapping an existing solid collider
      let blocked = false;
      for (const [eid, p] of world.query(Position)){
        if ((p.x|0) === x && (p.y|0) === y){ blocked = true; break; }
      }
      if (blocked) continue;

      used.add(k);

      // Pick a definition
      const idx = Math.max(0, Math.min(MONSTER_DEFS.length - 1, (sample(world) * MONSTER_DEFS.length) | 0));
      const def = MONSTER_DEFS[idx] || { name:'Goblin', glyph:'g', fg:'#7cc55b', maxHp:6, attack:3, defense:0 };

      // Map def.attack to CombatStats
      const atk = Math.max(1, def.attack|0);
      const atkMin = Math.max(1, Math.floor(atk * 0.8));
      const atkMax = Math.max(atkMin, Math.floor(atk * 1.2));

      // Defer creation to respect any in-tick constraints
      createDeferred(world, MonsterArchetype, {
        Position: { x, y },
        Glyph: { char: (def.glyph || def.name?.[0] || 'm'), fg: def.fg || '#f55' },
        Health: { maxHp: def.maxHp ?? 6, hp: def.maxHp ?? 6 },
        CombatStats: { atkMin, atkMax, defense: def.defense|0 },
        // Pass through callback so combat can invoke on successful hits
        Monster: { ai: 'basic', visionRange: 12, name: def.name, onHit: def.onHit || null }
      });

      placed++;
    }

    // Mark so we only spawn once per level
    lvl._monstersSpawned = true;
  }
}

export default monsterSpawnSystem;
