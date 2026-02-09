// rules/environment/dungeon/populate.js
// Generate spawn points for a chunk based on rooms and depth.

import { createRng } from '../../../lib/ecs-js/rng.js';
import { createFrom } from '../../../lib/ecs-js/archetype.js';
import { Position } from '../../components/Position.js';
import { ItemInfo } from '../../components/ItemInfo.js';
import { Monster } from '../../archetypes/Creatures.js';
import { HealthPotion, GoldStack } from '../../archetypes/Items.js';
import { buildEquipmentItem } from '../../data/equipmentLoader.js';
import { pickMonster, pickItem } from './tables.js';
import { CHUNK_SIZE } from './constants.js';

/**
 * @typedef {Object} SpawnPoint
 * @property {number} x - world X
 * @property {number} y - world Y
 * @property {string} kind - 'monster', 'gold', 'potion', 'equipment'
 * @property {Object} params
 */

/**
 * Generate spawn points for a chunk.
 * @param {import('./chunk.js').ChunkData} chunk
 * @param {{difficultyMult:number, depth:number}} floorPlan
 * @param {Object} rng - createRng() instance
 * @returns {SpawnPoint[]}
 */
export function populateChunk(chunk, floorPlan, rng) {
  const spawns = [];
  const diff = floorPlan.difficultyMult;

  for (const room of chunk.rooms) {
    const area = room.w * room.h;

    // Monster density: ~1 per 20-30 floor tiles, scaled by depth
    const monsterBudget = Math.max(0, Math.floor(area / rng.int(20, 30) * diff));
    for (let i = 0; i < monsterBudget; i++) {
      const mx = room.x + 1 + rng.int(0, Math.max(0, room.w - 3));
      const my = room.y + 1 + rng.int(0, Math.max(0, room.h - 3));
      spawns.push({
        x: mx, y: my,
        kind: 'monster',
        params: pickMonster(rng, floorPlan.depth),
      });
    }

    // Item density: ~1 per 40-60 floor tiles
    const itemBudget = Math.max(0, Math.floor(area / rng.int(40, 60)));
    for (let i = 0; i < itemBudget; i++) {
      const ix = room.x + 1 + rng.int(0, Math.max(0, room.w - 3));
      const iy = room.y + 1 + rng.int(0, Math.max(0, room.h - 3));
      const item = pickItem(rng, floorPlan.depth);
      spawns.push({
        x: ix, y: iy,
        kind: item.kind,
        params: item,
      });
    }
  }

  return spawns;
}

/**
 * Materialize a spawn point into an ECS entity.
 * @param {import('../../../lib/ecs-js/index.js').World} world
 * @param {SpawnPoint} spawn
 * @returns {number|null} entity ID
 */
export function materializeSpawn(world, spawn) {
  switch (spawn.kind) {
    case 'monster': {
      const p = spawn.params;
      return createFrom(world, Monster, {
        x: spawn.x, y: spawn.y,
        name: p.name,
        identity: p.identity,
        maxHp: p.maxHp,
        faction: p.faction,
        attackDerived: p.attackDerived,
        defenseDerived: p.defenseDerived,
        naturalDamageDice: p.naturalDamageDice,
        sizeClass: p.sizeClass,
        massKg: p.massKg,
        resistances: p.resistances,
      });
    }
    case 'gold': {
      const id = createFrom(world, GoldStack, {});
      world.add(id, Position, { x: spawn.x, y: spawn.y });
      world.mutate(id, ItemInfo, r => { r.count = spawn.params.count; });
      return id;
    }
    case 'potion': {
      const id = createFrom(world, HealthPotion, {});
      world.add(id, Position, { x: spawn.x, y: spawn.y });
      return id;
    }
    case 'equipment': {
      const id = buildEquipmentItem(world, spawn.params.equipId);
      world.add(id, Position, { x: spawn.x, y: spawn.y });
      return id;
    }
    default:
      return null;
  }
}
