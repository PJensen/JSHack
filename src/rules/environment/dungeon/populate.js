// rules/environment/dungeon/populate.js
// Generate spawn points for a chunk based on rooms and depth.

import { createRng } from '../../../lib/ecs-js/rng.js';
import { createFrom } from '../../../lib/ecs-js/archetype.js';
import { Position } from '../../components/Position.js';
import { ItemInfo } from '../../components/ItemInfo.js';
import { Monster, Shopkeeper } from '../../archetypes/Creatures.js';
import { ShopInventory } from '../../components/ShopInventory.js';
import { generateShopStock } from '../../data/shopStock.js';
import { HealthPotion, GoldStack, ArrowsStack, FireArrowsStack, ScrollOfMapping } from '../../archetypes/Items.js';
import { buildEquipmentItem } from '../../data/equipmentLoader.js';
import { pickMonster, pickItem, pickTrap } from './tables.js';
import { CHUNK_SIZE } from './constants.js';
import { getItem } from '../../data/items.js';
import { NamedIdentity } from '../../components/NamedIdentity.js';
import { Chest } from '../../archetypes/Door.js';
import { Interactable } from '../../components/Interactable.js';
import { Trap } from '../../components/Trap.js';

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

    // Item density: ~1 per 15-25 floor tiles
    const itemBudget = Math.max(0, Math.floor(area / rng.int(15, 25)));
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

    // Trap density: ~1 per 50-80 floor tiles
    const trapBudget = Math.max(0, Math.floor(area / rng.int(50, 80)));
    for (let i = 0; i < trapBudget; i++) {
      const tx = room.x + 1 + rng.int(0, Math.max(0, room.w - 3));
      const ty = room.y + 1 + rng.int(0, Math.max(0, room.h - 3));
      const trap = pickTrap(rng, floorPlan.depth);
      spawns.push({ x: tx, y: ty, kind: 'trap', params: trap });
    }

    // Chest: ~30% chance per room
    if (rng.next() < 0.30) {
      const chx = room.x + 1 + rng.int(0, Math.max(0, room.w - 3));
      const chy = room.y + 1 + rng.int(0, Math.max(0, room.h - 3));
      const d = floorPlan.depth;
      const tableId = d >= 14 ? 'chest:legendary' : d >= 8 ? 'chest:magic' : 'chest:basic';
      spawns.push({ x: chx, y: chy, kind: 'chest', params: { lootTable: tableId } });
    }
  }

  // Shopkeeper: one per chunk, first eligible room, ~30% chance
  if (chunk.rooms.length > 0 && rng.next() < 0.30) {
    const room = chunk.rooms[0];
    const sx = room.x + 1 + rng.int(0, Math.max(0, room.w - 3));
    const sy = room.y + 1 + rng.int(0, Math.max(0, room.h - 3));
    spawns.push({ x: sx, y: sy, kind: 'shopkeeper', params: { depth: floorPlan.depth } });
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
        naturalScript: p.naturalScript,
        sizeClass: p.sizeClass,
        massKg: p.massKg,
        resistances: p.resistances,
        speed: p.speed,
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
      const id = buildEquipmentItem(world, spawn.params.equipId, {
        affixes: spawn.params.affixes || [],
      });
      world.add(id, Position, { x: spawn.x, y: spawn.y });
      return id;
    }
    case 'arrows': {
      const id = createFrom(world, ArrowsStack, {});
      world.add(id, Position, { x: spawn.x, y: spawn.y });
      return id;
    }
    case 'fire_arrows': {
      const id = createFrom(world, FireArrowsStack, {});
      world.add(id, Position, { x: spawn.x, y: spawn.y });
      return id;
    }
    case 'scroll': {
      const id = createFrom(world, ScrollOfMapping, {});
      world.add(id, Position, { x: spawn.x, y: spawn.y });
      return id;
    }
    case 'chest': {
      const id = createFrom(world, Chest, { x: spawn.x, y: spawn.y });
      const inter = world.get(id, Interactable);
      if (inter) inter.params = { lootTable: spawn.params.lootTable };
      return id;
    }
    case 'trap': {
      const p = spawn.params;
      const id = world.create();
      world.add(id, Position, { x: spawn.x, y: spawn.y });
      world.add(id, Trap, {
        type: p.type,
        script: p.script,
        params: p.params || {},
        revealed: false,
        armed: true,
      });
      // No NamedIdentity — trap is invisible until triggered
      return id;
    }
    case 'shopkeeper': {
      const id = createFrom(world, Shopkeeper, { x: spawn.x, y: spawn.y });
      const depth = spawn.params.depth || 1;
      const shopRng = createRng(((world.seed >>> 0) ^ ((id * 0x9e3779b9) >>> 0) ^ 0x5470) >>> 0);
      const stock = generateShopStock(world, depth, shopRng);
      const shop = world.get(id, ShopInventory);
      if (shop) shop.items = stock;
      return id;
    }
    case 'book': {
      const def = getItem(spawn.params.bookId);
      if (!def) return null;
      const id = world.create();
      world.add(id, NamedIdentity, { name: def.name, identity: def.id });
      world.add(id, ItemInfo, {
        type: def.type, slot: def.slot, weight: 1, value: 0,
        description: def.description, count: 1,
      });
      world.add(id, Position, { x: spawn.x, y: spawn.y });
      return id;
    }
    default:
      return null;
  }
}
