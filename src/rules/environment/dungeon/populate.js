// rules/environment/dungeon/populate.js
// Generate spawn points for a chunk based on rooms and depth.

import { createRng } from '../../../lib/ecs-js/rng.js';
import { createFrom } from '../../../lib/ecs-js/archetype.js';
import { Position } from '../../components/Position.js';
import { ItemInfo } from '../../components/ItemInfo.js';
import { Monster, Shopkeeper } from '../../archetypes/Creatures.js';
import { ShopInventory } from '../../components/ShopInventory.js';
import { generateShopItem } from '../../data/shopStock.js';
import { HealthPotion, GoldStack, ArrowsStack, FireArrowsStack, ScrollOfMapping } from '../../archetypes/Items.js';
import { buildCatalogItem } from '../../data/itemCatalogLoader.js';
import { pickMonster, pickItem, pickTrap, pickSpawner } from './tables.js';
import { Chest } from '../../archetypes/Chest.js';
import { SpikeTrap, SnakeTrap } from '../../archetypes/Traps.js';
import { Spawner } from '../../archetypes/Spawner.js';
import { Tombstone, generateEpitaph } from '../../archetypes/Tombstone.js';
import { HomeBed, HomeChest, HomeSign, BerryBush, HerbPatch } from '../../archetypes/Overworld.js';
import { pickDungeonBook } from '../../data/dungeonBooks.js';
import { Inventory } from '../../components/Inventory.js';
import { resolveLootTable, materializeDrop } from '../../data/lootResolver.js';
import { RoomMetadata } from '../../components/RoomMetadata.js';
import { addItemEntityToInventory } from '../../utils/inventoryStacking.js';
import { CHUNK_SIZE, TILE_FLOOR, TILE_DOOR, TILE_STAIR_DOWN, TILE_STAIR_UP } from './constants.js';
import { NamedIdentity } from '../../components/NamedIdentity.js';
import { isIdentified } from '../../data/identification.js';
import { getUnidentifiedGemValue } from '../../data/gemPricing.js';

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
  const SPAWNER_CHANCE_PER_MONSTER = 0.06; // Convert room monster budget into a per-room nest chance.

  for (const room of chunk.rooms) {
    const area = room.w * room.h;

    // Monster density: ~1 per 20-30 floor tiles, scaled by depth
    const totalMonsterBudget = Math.max(0, Math.floor(area / rng.int(20, 30) * diff));
    const spawnerChance = Math.min(0.45, totalMonsterBudget * SPAWNER_CHANCE_PER_MONSTER);
    const spawnerBudget = totalMonsterBudget > 0 && rng.next() < spawnerChance ? 1 : 0;
    const monsterBudget = Math.max(0, totalMonsterBudget - spawnerBudget);

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

  // Shopkeeper: one per chunk, only in dead-end rooms (exactly one perimeter entrance), ~30% chance.
  // Extra rule: never use the origin chunk's spawn room (rooms[0] in chunk 0,0).
  const spawnRoom = (chunk.chunkX === 0 && chunk.chunkY === 0 && chunk.rooms.length > 0)
    ? chunk.rooms[0]
    : null;
  const eligibleShopRooms = chunk.rooms.filter((room) => {
    const isDeadEnd = countRoomEntrances(room, chunk) === 1;
    const isSpawnRoom = !!spawnRoom &&
      room.x === spawnRoom.x &&
      room.y === spawnRoom.y &&
      room.w === spawnRoom.w &&
      room.h === spawnRoom.h;
    return isDeadEnd && !isSpawnRoom;
  });
  if (eligibleShopRooms.length > 0 && rng.next() < 0.30) {
    const room = eligibleShopRooms[rng.int(0, eligibleShopRooms.length - 1)];

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

  // Decorative book spawning: ~15% chance per chunk, at most one per chunk
  if (chunk.rooms.length > 0 && rng.next() < 0.15) {
    const room = chunk.rooms[rng.int(0, chunk.rooms.length - 1)];
    const bx = room.x + 1 + rng.int(0, Math.max(0, room.w - 3));
    const by = room.y + 1 + rng.int(0, Math.max(0, room.h - 3));
    const book = pickDungeonBook(rng);
    spawns.push({ x: bx, y: by, kind: 'book', params: { bookId: book.id } });
  }

  return spawns;
}

/**
 * Count contiguous perimeter openings from a room into passable non-room space.
 * This models "entrances" (dead-end detection), not literal door tiles.
 * @param {{x:number,y:number,w:number,h:number}} room
 * @param {{chunkX:number,chunkY:number,tiles:Uint8Array}} chunk
 * @returns {number}
 */
function countRoomEntrances(room, chunk) {
  const ox = chunk.chunkX * CHUNK_SIZE;
  const oy = chunk.chunkY * CHUNK_SIZE;
  const rx = room.x - ox;
  const ry = room.y - oy;
  const rw = room.w;
  const rh = room.h;
  const tiles = chunk.tiles;

  function getTile(x, y) {
    if (x < 0 || y < 0 || x >= CHUNK_SIZE || y >= CHUNK_SIZE) return -1;
    return tiles[y * CHUNK_SIZE + x];
  }

  function isPassable(tile) {
    return tile === TILE_FLOOR || tile === TILE_DOOR || tile === TILE_STAIR_DOWN || tile === TILE_STAIR_UP;
  }

  let entrances = 0;

  // West openings: outside cells at (rx-1, ry..ry+rh-1)
  {
    let prevOpen = false;
    for (let y = ry; y < ry + rh; y++) {
      const open = isPassable(getTile(rx - 1, y));
      if (open && !prevOpen) entrances++;
      prevOpen = open;
    }
  }
  // East openings: outside cells at (rx+rw, ry..ry+rh-1)
  {
    let prevOpen = false;
    for (let y = ry; y < ry + rh; y++) {
      const open = isPassable(getTile(rx + rw, y));
      if (open && !prevOpen) entrances++;
      prevOpen = open;
    }
  }
  // North openings: outside cells at (rx..rx+rw-1, ry-1)
  {
    let prevOpen = false;
    for (let x = rx; x < rx + rw; x++) {
      const open = isPassable(getTile(x, ry - 1));
      if (open && !prevOpen) entrances++;
      prevOpen = open;
    }
  }
  // South openings: outside cells at (rx..rx+rw-1, ry+rh)
  {
    let prevOpen = false;
    for (let x = rx; x < rx + rw; x++) {
      const open = isPassable(getTile(x, ry + rh));
      if (open && !prevOpen) entrances++;
      prevOpen = open;
    }
  }
  return entrances;
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
      const id = buildCatalogItem(world, spawn.params.equipId, {
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
            addItemEntityToInventory(world, inv, eid, { removePosition: false });
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
        // Unidentified gems use appearance-based pricing
        let baseValue = info.value || 0;
        if (info.type === 'gem') {
          const ni = world.get(itemId, NamedIdentity);
          const identity = ni?.identity || '';
          if (!identity || !isIdentified(identity)) {
            baseValue = getUnidentifiedGemValue(info.description) || baseValue;
          }
        }
        const price = Math.ceil(baseValue * 1.3); // 30% markup
        // Store price temporarily in spawn params for post-processing
        spawn._calculatedPrice = price;
        spawn._itemId = itemId;
      }

      return itemId;
    }
    case 'book': {
      let id = null;
      try {
        id = buildCatalogItem(world, spawn.params.bookId, { count: 1 });
      } catch {
        return null;
      }
      if (!(id > 0)) return null;
      world.add(id, Position, { x: spawn.x, y: spawn.y });
      return id;
    }
    case 'home_bed':
      return createFrom(world, HomeBed, { x: spawn.x, y: spawn.y });
    case 'home_chest':
      return createFrom(world, HomeChest, { x: spawn.x, y: spawn.y });
    case 'home_sign':
      return createFrom(world, HomeSign, { x: spawn.x, y: spawn.y });
    case 'harvest_berries':
      return createFrom(world, BerryBush, { x: spawn.x, y: spawn.y });
    case 'harvest_herbs':
      return createFrom(world, HerbPatch, { x: spawn.x, y: spawn.y });
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
