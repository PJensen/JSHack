// rules/environment/dungeon/populate.js
// Generate spawn points for a chunk based on rooms and depth.

import { createRng } from '../../../lib/ecs-js/rng.js';
import { createFrom } from '../../../lib/ecs-js/archetype.js';
import { Position } from '../../components/Position.js';
import { ItemInfo } from '../../components/ItemInfo.js';
import { Monster, Shopkeeper } from '../../archetypes/Creatures.js';
import { ShopInventory } from '../../components/ShopInventory.js';
import { generateShopItem } from '../../data/shopStock.js';
import { HealthPotion, GoldStack, ArrowsStack, FireArrowsStack, ScrollOfMapping, MagicItem } from '../../archetypes/Items.js';
import { buildEquipmentItem } from '../../data/equipmentLoader.js';
import { pickMonster, pickItem, pickTrap, pickSpawner } from './tables.js';
import { getItem } from '../../data/items.js';
import { Chest } from '../../archetypes/Chest.js';
import { SpikeTrap, SnakeTrap } from '../../archetypes/Traps.js';
import { Spawner } from '../../archetypes/Spawner.js';
import { Tombstone, generateEpitaph } from '../../archetypes/Tombstone.js';
import { Inventory } from '../../components/Inventory.js';
import { resolveLootTable, materializeDrop } from '../../data/lootResolver.js';
import { RoomMetadata } from '../../components/RoomMetadata.js';

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
 * @param {Object} [tombstoneRepo] - Tombstone repository for placing tombstones
 * @returns {SpawnPoint[]}
 */
export function populateChunk(chunk, floorPlan, rng, tombstoneRepo = null) {
  const spawns = [];
  const diff = floorPlan.difficultyMult;
  const SPAWNER_FRACTION = 0.03; // 3% of monster budget becomes spawners (~1 every 3-5 rooms)

  for (const room of chunk.rooms) {
    const area = room.w * room.h;

    // Monster density: ~1 per 20-30 floor tiles, scaled by depth
    const totalMonsterBudget = Math.max(0, Math.floor(area / rng.int(20, 30) * diff));
    const spawnerBudget = Math.floor(totalMonsterBudget * SPAWNER_FRACTION);
    const monsterBudget = totalMonsterBudget - spawnerBudget;

    // Place spawners (create monster packs)
    for (let i = 0; i < spawnerBudget; i++) {
      const mx = room.x + 1 + rng.int(0, Math.max(0, room.w - 3));
      const my = room.y + 1 + rng.int(0, Math.max(0, room.h - 3));
      spawns.push({
        x: mx, y: my,
        kind: 'spawner',
        params: pickSpawner(rng, floorPlan.depth),
      });
    }

    // Place individual monsters
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
      spawns.push({ x: chx, y: chy, kind: 'chest', params: { lootTable: tableId, depth: d } });
    }
  }

  // Shopkeeper: one per chunk, first eligible room, ~30% chance
  if (chunk.rooms.length > 0 && rng.next() < 0.30) {
    const room = chunk.rooms[0];

    // Place shopkeeper near the room entrance (prefer near doors)
    const sx = room.x + 1 + rng.int(0, Math.max(0, room.w - 3));
    const sy = room.y + 1 + rng.int(0, Math.max(0, room.h - 3));

    spawns.push({
      x: sx,
      y: sy,
      kind: 'shopkeeper',
      params: {
        depth: floorPlan.depth,
        room: { x: room.x, y: room.y, w: room.w, h: room.h }
      }
    });

    // Scatter shop items on the floor throughout the room (5-12 items)
    const itemCount = rng.int(5, 12);
    for (let i = 0; i < itemCount; i++) {
      const ix = room.x + 1 + rng.int(0, Math.max(0, room.w - 3));
      const iy = room.y + 1 + rng.int(0, Math.max(0, room.h - 3));
      spawns.push({
        x: ix,
        y: iy,
        kind: 'shop_item',
        params: { depth: floorPlan.depth }
      });
    }
  }

  // Tombstone spawning: retrieve tombstones for this depth
  if (tombstoneRepo && chunk.rooms.length > 0) {
    // Get random tombstones for this depth (1-3 per chunk, based on availability)
    const tombstoneCount = Math.min(3, chunk.rooms.length);
    const tombstones = tombstoneRepo.getRandomForDepth(
      floorPlan.depth,
      tombstoneCount,
      rng
    );

    // Place tombstones in random rooms
    for (const tombstoneData of tombstones) {
      const roomIdx = Math.floor(rng.next() * chunk.rooms.length);
      const room = chunk.rooms[roomIdx];
      const tx = room.x + 1 + rng.int(0, Math.max(0, room.w - 3));
      const ty = room.y + 1 + rng.int(0, Math.max(0, room.h - 3));

      spawns.push({
        x: tx,
        y: ty,
        kind: 'tombstone',
        params: tombstoneData
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
      // Pre-populate chest inventory from loot table
      const lootTable = spawn.params.lootTable || 'chest:basic';
      const chestSeed = ((world.seed >>> 0) ^ ((id * 0x9e3779b9) >>> 0) ^ 0xCE57) >>> 0;
      const chestRng = createRng(chestSeed);
      const depth = spawn.params.depth || 1;
      const drops = resolveLootTable(lootTable, chestRng, depth);
      const inv = world.get(id, Inventory);
      if (inv) {
        const dummyPos = { x: spawn.x, y: spawn.y };
        for (const drop of drops) {
          const eid = materializeDrop(world, drop, dummyPos);
          if (eid != null) {
            try { world.remove(eid, Position); } catch {}
            inv.items.push(eid);
          }
        }
      }
      return id;
    }
    case 'trap': {
      const p = spawn.params;
      const arch = p.type === 'snake' ? SnakeTrap : SpikeTrap;
      return createFrom(world, arch, {
        x: spawn.x, y: spawn.y,
        trapParams: p.params || {},
      });
    }
    case 'spawner': {
      const p = spawn.params;
      const monsterParams = p.monsterType;
      // Create spawner with specific identity for display palette lookup
      return createFrom(world, Spawner, {
        x: spawn.x,
        y: spawn.y,
        name: `${monsterParams.name} Nest`,
        identity: 'spawner',  // Used by display layer to lookup glyph/color
        spawnParams: monsterParams,
        totalToSpawn: p.packSize,
        cooldownTicks: 15,
        maxConcurrent: 3,
        spawnRadius: 2,
        maxHp: 50,  // Make spawners destructible but not too fragile
      });
    }
    case 'shopkeeper': {
      const id = createFrom(world, Shopkeeper, { x: spawn.x, y: spawn.y });
      const depth = spawn.params.depth || 1;

      // Create a room metadata entity to mark this as a shop
      if (spawn.params.room) {
        const roomEntity = world.create();
        world.add(roomEntity, RoomMetadata, {
          roomType: 'shop',
          x: spawn.params.room.x,
          y: spawn.params.room.y,
          w: spawn.params.room.w,
          h: spawn.params.room.h,
          shopkeeperId: id,
        });
      }

      // Keep ShopInventory component for pricing info, but start with empty items
      const shop = world.get(id, ShopInventory);
      if (shop) shop.items = [];

      return id;
    }
    case 'shop_item': {
      const depth = spawn.params.depth || 1;
      const shopRng = createRng(((world.seed >>> 0) ^ ((spawn.x * 0x9e3779b9) >>> 0) ^ (spawn.y * 0x45d9f3b) ^ 0x5470) >>> 0);

      // Generate exactly one item for this floor spawn (no orphan stock entities).
      const itemId = generateShopItem(world, depth, shopRng);
      if (itemId == null) return null;

      // Place it on the floor
      world.add(itemId, Position, { x: spawn.x, y: spawn.y });

      // Calculate price (will be added as Unpaid in post-processing)
      const info = world.get(itemId, ItemInfo);
      if (info) {
        const price = Math.ceil((info.value || 0) * 1.3); // 30% markup
        // Store price temporarily in spawn params for post-processing
        spawn._calculatedPrice = price;
        spawn._itemId = itemId;
      }

      return itemId;
    }
    case 'book': {
      const def = getItem(spawn.params.bookId);
      if (!def) return null;
      const id = createFrom(world, MagicItem, {
        name: def.name, identity: def.id,
        type: def.type, slot: def.slot, weight: 1, value: 0,
        description: def.description, count: 1,
      });
      world.add(id, Position, { x: spawn.x, y: spawn.y });
      return id;
    }
    case 'tombstone': {
      const data = spawn.params;
      const epitaph = generateEpitaph(data);

      return createFrom(world, Tombstone, {
        x: spawn.x,
        y: spawn.y,
        playerName: data.playerName,
        depth: data.depth,
        cause: data.cause,
        killerName: data.killerName,
        turn: data.turn,
        epitaph: epitaph,
      });
    }
    default:
      return null;
  }
}
