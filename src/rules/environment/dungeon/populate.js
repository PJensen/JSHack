// rules/environment/dungeon/populate.js
// Generate spawn points for a chunk based on rooms and depth.

import { createRng } from '../../../lib/ecs-js/rng.js';
import { createFrom } from '../../../lib/ecs-js/archetype.js';
import { Position } from '../../components/Position.js';
import { NamedIdentity } from '../../components/NamedIdentity.js';
import { ItemInfo } from '../../components/ItemInfo.js';
import { Interactable } from '../../components/Interactable.js';
import { Collider } from '../../components/Collider.js';
import { Material } from '../../components/Material.js';
import { Polymorph } from '../../components/Polymorph.js';
import { DoorKey } from '../../components/DoorKey.js';
import { DoorLock } from '../../components/DoorLock.js';
import { DoorState } from '../../components/DoorState.js';
import { Shopkeeper, Human } from '../../archetypes/Creatures.js';
import { Equipment } from '../../components/Equipment.js';
import { ShopInventory } from '../../components/ShopInventory.js';
import * as shopStock from '../../data/shopStock.js';
import { Unpaid } from '../../components/Unpaid.js';
import { HealthPotion, GoldStack, ArrowsStack, FireArrowsStack, ScrollOfMapping } from '../../archetypes/Items.js';
import { buildCatalogItem } from '../../data/itemCatalogLoader.js';
import { pickMonster, pickItem, pickTrap, pickSpawner, pickSpecificMonster, pickSpecificSpawner } from './tables.js';
import { Chest } from '../../archetypes/Chest.js';
import { SpikeTrap, SnakeTrap, ShockTrap } from '../../archetypes/Traps.js';
import { Spawner } from '../../archetypes/Spawner.js';
import { Tombstone, generateEpitaph } from '../../archetypes/Tombstone.js';
import {
  HomeBed,
  HomeChest,
  HomeSign,
  BerryBush,
  HerbPatch,
  ThornBramble,
  VenomFern,
  MoonleafCluster,
  EmberRootPatch,
  OreVeinIron,
  OreVeinCoal,
  OreVeinStone,
  TreeNode,
  AlchemyBench,
  Anvil,
  Furnace,
  CookingFire,
  CropWheat,
  CropCarrot,
  CropCorn,
  Well,
  Scarecrow,
  TavernKeg,
  TavernTable,
  TavernBench,
  TavernPillar,
  TavernSign,
  Millstone,
  ChurchAltar,
  ChurchPew,
  ChurchSign,
  ChurchFont,
  ChurchWindow,
  WindowArched,
  WindowIronGrate,
  WindowShuttered,
  WindowRound,
  WindowRect,
  FlowerRose,
  FlowerSunflower,
  FlowerTulip,
  FlowerDaisy,
  FlowerBluebell,
  SmithyChest,
  MillChest,
  LumberChest,
  SmithySign,
  PotionShelf,
  HerbChest,
  TavernChest,
  ApothecarySign,
  GemShopSign,
  GemDisplayCase,
  MessageBoard,
  GraveTombstone,
  TownBell,
  Barrel,
  Crate,
  Woodpile,
  HayBale,
  LanternPost,
  RainBarrel,
  Wheelbarrow,
  MarketStall,
  Bench,
  Boulder,
  FallenLog,
  LilyPad,
  Cattail,
  Birdbath,
  Trellis,
} from '../../archetypes/Overworld.js';
import { pickDungeonBook } from '../../data/dungeonBooks.js';
import { TOWNFOLK } from '../../data/townfolk.js';
import { TownfolkJob } from '../../components/TownfolkJob.js';
import { Inventory } from '../../components/Inventory.js';
import { resolveLootTable, materializeDrop } from '../../data/lootResolver.js';
import { RoomMetadata } from '../../components/RoomMetadata.js';
import { addToInventory, inventoryItems } from '../../utils/inventoryFacade.js';
import { createItemById } from '../../utils/itemFactory.js';
import {
  CHUNK_SIZE, TILE_FLOOR, TILE_DOOR, TILE_STAIR_DOWN, TILE_STAIR_UP,
  TILE_ICE, TILE_SHALLOW_WATER, TILE_LAVA,
} from './constants.js';
import { setTile, getTile } from './tileMap.js';
import { appraiseItemValue, getUnidentifiedGemAppraisal } from '../../utils/shopAppraisal.js';
import { spawnMonsterEntity } from '../../utils/spawnMonsterEntity.js';
import {
  Fountain, Altar, Shrine, Statue,
  Sarcophagus, Pillar, WeaponRack, Mushrooms, Web, Torch, Urn,
} from '../../archetypes/RoomFeatures.js';

// Weighted room feature table. Weight determines relative likelihood.
const ROOM_FEATURES = [
  { kind: 'fountain',    weight: 8 },
  { kind: 'altar',       weight: 6 },
  { kind: 'shrine',      weight: 6 },
  { kind: 'statue',      weight: 10 },
  { kind: 'sarcophagus', weight: 7 },
  { kind: 'pillar',      weight: 10 },
  { kind: 'weapon_rack', weight: 6 },
  { kind: 'mushrooms',   weight: 8 },
  { kind: 'torch',       weight: 2 }, // very rare standalone
  { kind: 'urn',         weight: 7 },
];
const ROOM_FEATURE_TOTAL_WEIGHT = ROOM_FEATURES.reduce((s, f) => s + f.weight, 0);
const SHOP_MIMIC_CHANCE = 0.08;
const DISPLAY_CONTAINER_IDENTITIES = new Set(["potion_shelf", "gem_display_case"]);

function findDoorEntityAt(world, x, y) {
  for (const [id, pos] of world.query(Position, DoorState)) {
    if (pos.x === x && pos.y === y) return id;
  }
  return 0;
}

function createShopDoorKey(world, lockId, role) {
  const itemId = world.create();
  const label = role === "gem_vendor" ? "Gem Shop Key" : "Apothecary Key";
  const identity = role === "gem_vendor" ? "key_gem_shop" : "key_apothecary";
  world.add(itemId, NamedIdentity, { name: label, identity });
  world.add(itemId, ItemInfo, {
    type: "tool",
    slot: "",
    weight: 0.1,
    value: 0,
    description: `A shop key cut for ${role === "gem_vendor" ? "the gem shop" : "the apothecary"} door.`,
    count: 1,
  });
  world.add(itemId, Material, { kind: "iron" });
  world.add(itemId, DoorKey, { lockId });
  return itemId;
}

function shopDoorLockId(role, x, y) {
  return `overworld:shop:${String(role || "vendor")}:${Number(x) | 0},${Number(y) | 0}`;
}

function actorHasShopDoorKey(world, actorId, lockId) {
  for (const itemId of inventoryItems(world, actorId)) {
    if (String(world.get(itemId, DoorKey)?.lockId || "") === lockId) return true;
  }
  return false;
}

function ensureShopDoorAccess(world, actorId, role, doorId) {
  if (!(actorId > 0) || !(doorId > 0)) return;
  const pos = world.get(doorId, Position);
  if (!pos) return;

  const lockId = shopDoorLockId(role, pos.x, pos.y);
  if (world.has(doorId, DoorLock)) world.set(doorId, DoorLock, { lockId });
  else world.add(doorId, DoorLock, { lockId });

  const doorState = world.get(doorId, DoorState);
  if (doorState) {
    world.set(doorId, DoorState, { ...doorState, open: false, locked: true });
  }

  if (!actorHasShopDoorKey(world, actorId, lockId)) {
    const keyId = createShopDoorKey(world, lockId, String(role || ""));
    addToInventory(world, actorId, keyId);
  }
}

function assignShopDoorKey(world, actorId, role, shopDoor) {
  if (!(actorId > 0) || !shopDoor) return;
  const doorId = findDoorEntityAt(world, Number(shopDoor.x) | 0, Number(shopDoor.y) | 0);
  const lockId = shopDoorLockId(role, Number(shopDoor.x) | 0, Number(shopDoor.y) | 0);
  if (!actorHasShopDoorKey(world, actorId, lockId)) {
    const keyId = createShopDoorKey(world, lockId, String(role || ""));
    addToInventory(world, actorId, keyId);
  }
  if (doorId > 0) ensureShopDoorAccess(world, actorId, role, doorId);
}

function isDoorOnRoomPerimeter(pos, room) {
  if (!pos || !room) return false;
  if (pos.x < room.x || pos.x >= room.x + room.w || pos.y < room.y || pos.y >= room.y + room.h) return false;
  return pos.x === room.x
    || pos.x === (room.x + room.w - 1)
    || pos.y === room.y
    || pos.y === (room.y + room.h - 1);
}

function findRoomDoor(world, room) {
  for (const [id, pos] of world.query(Position, DoorState)) {
    if (isDoorOnRoomPerimeter(pos, room)) return id;
  }
  return 0;
}

export function reconcileShopDoorAccess(world) {
  for (const [, room] of world.query(RoomMetadata)) {
    if (room.roomType !== "shop") continue;
    const actorId = Number(room.shopkeeperId || 0) | 0;
    if (!(actorId > 0)) continue;
    const job = world.get(actorId, TownfolkJob);
    if (!job) continue;
    const doorId = findRoomDoor(world, room);
    if (!(doorId > 0)) continue;
    ensureShopDoorAccess(world, actorId, job.role, doorId);
  }
}

function stockDisplayContainer(world, id, spawn, stockKind) {
  const inv = /** @type {any} */ (world.get(id, Inventory));
  if (!inv) return id;

  const seed = ((world.seed >>> 0) ^ ((id * 0x9e3779b9) >>> 0) ^ ((spawn.x * 0x45d9f3b) >>> 0) ^ ((spawn.y * 0x119de1f3) >>> 0)) >>> 0;
  const rng = createRng(seed);
  const count = stockKind === "gem" ? rng.int(2, 4) : rng.int(2, 3);

  for (let i = 0; i < count; i++) {
    let itemId = null;
    if (stockKind === "alchemy") itemId = shopStock.generateAlchemyShopItem(world, rng);
    else if (stockKind === "gem") itemId = shopStock.generateGemShopItem(world, rng);
    if (!(itemId > 0)) continue;
    const info = world.get(itemId, ItemInfo);
    if (info) world.mutate(itemId, ItemInfo, (r) => { r.identified = true; });
    addToInventory(world, id, itemId);
  }

  return id;
}

function pickRoomFeature(rng) {
  let roll = rng.next() * ROOM_FEATURE_TOTAL_WEIGHT;
  for (const f of ROOM_FEATURES) {
    roll -= f.weight;
    if (roll <= 0) return f.kind;
  }
  return ROOM_FEATURES[ROOM_FEATURES.length - 1].kind;
}

/** Pick a feature kind, optionally restricted to a string[] pool. */
function _pickFeature(rng, pool) {
  if (!pool) return pickRoomFeature(rng);
  const candidates = ROOM_FEATURES.filter(f => pool.includes(f.kind));
  if (candidates.length === 0) return pickRoomFeature(rng);
  const total = candidates.reduce((s, f) => s + f.weight, 0);
  let roll = rng.next() * total;
  for (const f of candidates) {
    roll -= f.weight;
    if (roll <= 0) return f.kind;
  }
  return candidates[candidates.length - 1].kind;
}

/**
 * @typedef {Object} SpawnPoint
 * @property {number} x - world X
 * @property {number} y - world Y
 * @property {string} kind - 'monster', 'mimic', 'gold', 'potion', 'equipment'
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
  const SPAWNER_CHANCE_PER_MONSTER = 0.35; // Convert room monster budget into a per-room nest chance.

  // Track occupied positions for solid/immovable features (decorations, chests, tombstones,
  // spawners) so nothing gets placed on top of something else solid.
  const solidPositions = new Set(); // "x,y" string keys
  const isSolid = (x, y) => solidPositions.has(`${x},${y}`);
  const markSolid = (x, y) => solidPositions.add(`${x},${y}`);

  // Pre-mark stair tiles so monsters, traps, and other spawns never land on them.
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const t = chunk.tiles[ly * CHUNK_SIZE + lx];
      if (t === TILE_STAIR_DOWN || t === TILE_STAIR_UP) {
        markSolid(chunk.chunkX * CHUNK_SIZE + lx, chunk.chunkY * CHUNK_SIZE + ly);
      }
    }
  }

  // Identify the player's entry room so we don't clutter it with a feature
  const entryRoom = (chunk.chunkX === 0 && chunk.chunkY === 0 && chunk.rooms.length > 0)
    ? chunk.rooms[0]
    : null;

  for (const room of chunk.rooms) {
    const area = room.w * room.h;

    // Place a room feature (~50% of non-entry rooms get one)
    const isEntryRoom = room === entryRoom;
    let roomHasWeaponRack = false;
    const featureRate = floorPlan.profile?.doorFeatureRate ?? 0.50;
    if (!isEntryRoom && rng.next() < featureRate) {
      const featureKind = _pickFeature(rng, floorPlan.profile?.featurePool ?? null);
      const cx = room.x + Math.floor(room.w / 2);
      const cy = room.y + Math.floor(room.h / 2);
      // Don't place a feature on a stair (or any other already-solid tile).
      if (!isSolid(cx, cy)) {
        spawns.push({ x: cx, y: cy, kind: featureKind, params: { depth: floorPlan.depth } });
        if (featureKind === 'weapon_rack') roomHasWeaponRack = true;
        markSolid(cx, cy);

        // Sacred rooms (altar or shrine) get a torch in each floor corner when the
        // room is large enough to have four obvious, distinct corner tiles.
        // room.x/y is the first floor tile; walls are carved outside at x-1, y-1.
        const isSacred = featureKind === 'altar' || featureKind === 'shrine';
        if (isSacred && room.w >= 4 && room.h >= 4) {
          const corners = [
            { x: room.x,             y: room.y             },
            { x: room.x + room.w - 1, y: room.y             },
            { x: room.x,             y: room.y + room.h - 1 },
            { x: room.x + room.w - 1, y: room.y + room.h - 1 },
          ];
          for (const c of corners) {
            spawns.push({ x: c.x, y: c.y, kind: 'torch', params: {} });
            markSolid(c.x, c.y);
          }
        }
      }
    }

    // Monster density: ~1 per 12-18 floor tiles, scaled by depth
    const totalMonsterBudget = Math.max(0, Math.floor(area / rng.int(12, 18) * diff));
    const spawnerChance = Math.min(0.60, totalMonsterBudget * SPAWNER_CHANCE_PER_MONSTER);
    const spawnerBudget = totalMonsterBudget > 0 && rng.next() < spawnerChance ? 1 : 0;
    const monsterBudget = Math.max(0, totalMonsterBudget - spawnerBudget);

    // Place spawners (create monster packs)
    // Never place a spawner on top of a dungeon decoration.
    let roomHasSpider = false;
    const roomSpawners = [];
    for (let i = 0; i < spawnerBudget; i++) {
      let mx, my, attempts = 0;
      do {
        mx = room.x + 1 + rng.int(0, Math.max(0, room.w - 3));
        my = room.y + 1 + rng.int(0, Math.max(0, room.h - 3));
        attempts++;
      } while (isSolid(mx, my) && attempts < 10);
      const sp = pickSpawner(rng, floorPlan.depth, floorPlan.profile?.monsterFilter ?? null);
      const isSpiderSpawner = sp.monsterType?.identity === 'spider' || sp.monsterType?.identity === 'cave_spider';
      if (!isSolid(mx, my)) {
        markSolid(mx, my);
        spawns.push({ x: mx, y: my, kind: 'spawner', params: sp });
        if (isSpiderSpawner) roomHasSpider = true;
        roomSpawners.push({ x: mx, y: my, isSpider: isSpiderSpawner });
      }
    }

    // Place individual monsters — avoid solid features (decorations, chests, spawners)
    for (let i = 0; i < monsterBudget; i++) {
      let mx, my, attempts = 0;
      do {
        mx = room.x + 1 + rng.int(0, Math.max(0, room.w - 3));
        my = room.y + 1 + rng.int(0, Math.max(0, room.h - 3));
        attempts++;
      } while (isSolid(mx, my) && attempts < 10);
      if (isSolid(mx, my)) continue;
      const mp = pickMonster(rng, floorPlan.depth, floorPlan.profile?.monsterFilter ?? null);
      spawns.push({ x: mx, y: my, kind: 'monster', params: mp });
      if (mp.identity === 'spider' || mp.identity === 'cave_spider') roomHasSpider = true;
    }

    // Scatter webs across ~30% of floor tiles in spider rooms.
    // Don't place webs on non-spider spawners; spider spawners are the exception.
    if (roomHasSpider) {
      for (let wy = room.y + 1; wy < room.y + room.h - 1; wy++) {
        for (let wx = room.x + 1; wx < room.x + room.w - 1; wx++) {
          if (rng.next() < 0.30) {
            const spawnerHere = roomSpawners.find(s => s.x === wx && s.y === wy);
            if (!spawnerHere || spawnerHere.isSpider) {
              spawns.push({ x: wx, y: wy, kind: 'web', params: {} });
            }
          }
        }
      }
    }

    // Item density: ~1 per 40-60 floor tiles (scarce — items should feel good to find)
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

    // Trap density: ~33% of rooms get a trap (infrequent enough to lull players)
    if (rng.next() < 0.33) {
      const trapBudget = area >= 64 ? rng.int(1, 2) : 1;
      for (let i = 0; i < trapBudget; i++) {
        let tx, ty, attempts = 0;
        do {
          tx = room.x + 1 + rng.int(0, Math.max(0, room.w - 3));
          ty = room.y + 1 + rng.int(0, Math.max(0, room.h - 3));
          attempts++;
        } while (isSolid(tx, ty) && attempts < 10);
        if (isSolid(tx, ty)) continue;
        const trap = pickTrap(rng, floorPlan.depth);
        spawns.push({ x: tx, y: ty, kind: 'trap', params: trap });
      }
    }

    // Chest: ~13% chance per room (rare find). Weapon racks count as equivalent — skip if the room already has one.
    // Never place on top of a decoration, sarcophagus, tombstone, spawner, or any other solid feature.
    if (!roomHasWeaponRack && rng.next() < 0.13) {
      let chx, chy, chAttempts = 0;
      do {
        chx = room.x + 1 + rng.int(0, Math.max(0, room.w - 3));
        chy = room.y + 1 + rng.int(0, Math.max(0, room.h - 3));
        chAttempts++;
      } while (isSolid(chx, chy) && chAttempts < 10);
      if (!isSolid(chx, chy)) {
        markSolid(chx, chy);
        const d = floorPlan.depth;
        const tableId = d >= 14 ? 'chest:legendary' : d >= 8 ? 'chest:magic' : 'chest:basic';
        spawns.push({ x: chx, y: chy, kind: 'chest', params: { lootTable: tableId, depth: d } });
      }
    }

    // Hazard tile patches — paint ice / shallow water / lava near room center
    if (!isEntryRoom && room.w >= 4 && room.h >= 4) {
      const depth = floorPlan.depth;
      const bias = floorPlan.profile?.hazardBias ?? null;
      let patchTile = 0;
      if (bias === 'water') {
        if (rng.next() < 0.20) patchTile = TILE_SHALLOW_WATER;
      } else if (bias === 'lava') {
        if (rng.next() < 0.15) patchTile = TILE_LAVA;
      } else if (bias === 'ice') {
        if (rng.next() < 0.15) patchTile = TILE_ICE;
      } else {
        patchTile =
          depth >= 12 && rng.next() < 0.05 ? TILE_LAVA :
          depth >= 8  && rng.next() < 0.08 ? TILE_SHALLOW_WATER :
          depth >= 3  && rng.next() < 0.08 ? TILE_ICE :
          0;
      }
      if (patchTile) {
        const pcx = room.x + Math.floor(room.w / 2);
        const pcy = room.y + Math.floor(room.h / 2);
        const painted = [];
        // Diamond/cross pattern: center + cardinal neighbors (3-5 tiles)
        const offsets = [[0,0], [-1,0], [1,0], [0,-1], [0,1]];
        for (const [ox, oy] of offsets) {
          const px = pcx + ox;
          const py = pcy + oy;
          if (px >= room.x && px < room.x + room.w &&
              py >= room.y && py < room.y + room.h) {
            painted.push({ x: px, y: py, tile: patchTile });
          }
        }
        if (painted.length > 0) {
          spawns.push({ x: 0, y: 0, kind: 'tile_paint', params: { tiles: painted } });
        }
      }
    }
  }

  // Depth 1 guaranteed content: skeleton archers, a rare monster, rat/spider spawners.
  // Only inject into the origin chunk so they appear once per floor.
  if (floorPlan.depth === 1 && chunk.chunkX === 0 && chunk.chunkY === 0) {
    const nonEntryRooms = chunk.rooms.filter(r => r !== entryRoom);
    if (nonEntryRooms.length >= 1) {
      let roomIdx = 0;
      const nextRoom = () => nonEntryRooms[roomIdx++ % nonEntryRooms.length];

      // Guaranteed skeleton archer
      const archerRoom = nextRoom();
      const ax = archerRoom.x + 1 + rng.int(0, Math.max(0, archerRoom.w - 3));
      const ay = archerRoom.y + 1 + rng.int(0, Math.max(0, archerRoom.h - 3));
      const archerParams = pickSpecificMonster('skeleton_archer', 1);
      if (archerParams) spawns.push({ x: ax, y: ay, kind: 'monster', params: archerParams });

      // Guaranteed rare monster (pit viper)
      const rareRoom = nextRoom();
      const rx = rareRoom.x + 1 + rng.int(0, Math.max(0, rareRoom.w - 3));
      const ry = rareRoom.y + 1 + rng.int(0, Math.max(0, rareRoom.h - 3));
      const rareParams = pickSpecificMonster('pit_viper', 1);
      if (rareParams) spawns.push({ x: rx, y: ry, kind: 'monster', params: rareParams });

      // Guaranteed rat/spider spawners (2 nests, picking rat or cave_spider)
      const verminIds = ['rat', 'cave_spider'];
      for (let i = 0; i < 2; i++) {
        const vRoom = nextRoom();
        let vx, vy, vAttempts = 0;
        do {
          vx = vRoom.x + 1 + rng.int(0, Math.max(0, vRoom.w - 3));
          vy = vRoom.y + 1 + rng.int(0, Math.max(0, vRoom.h - 3));
          vAttempts++;
        } while (isSolid(vx, vy) && vAttempts < 10);
        const verminId = rng.choice(verminIds);
        const sp = pickSpecificSpawner(rng, verminId, 1);
        if (sp && !isSolid(vx, vy)) {
          markSolid(vx, vy);
          spawns.push({ x: vx, y: vy, kind: 'spawner', params: sp });
          // Scatter webs if this is a spider spawner
          if (verminId === 'cave_spider') {
            for (let wy = vRoom.y + 1; wy < vRoom.y + vRoom.h - 1; wy++) {
              for (let wx = vRoom.x + 1; wx < vRoom.x + vRoom.w - 1; wx++) {
                if (rng.next() < 0.30) {
                  spawns.push({ x: wx, y: wy, kind: 'web', params: {} });
                }
              }
            }
          }
        }
      }
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
  const shopChance = floorPlan.profile?.shopChance ?? 0.30;
  if (eligibleShopRooms.length > 0 && rng.next() < shopChance) {
    const room = eligibleShopRooms[rng.int(0, eligibleShopRooms.length - 1)];

    // Shop rooms must not start with regular dungeon enemies, spawners, or traps.
    for (let i = spawns.length - 1; i >= 0; i--) {
      const sp = spawns[i];
      if (!isPointInRoom(sp.x, sp.y, room)) continue;
      if (sp.kind === 'monster' || sp.kind === 'spawner' || sp.kind === 'trap') {
        spawns.splice(i, 1);
      }
    }

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

    // Rare trap-chest in shops: looks like a chest until touched.
    if (rng.next() < SHOP_MIMIC_CHANCE) {
      let mx = room.x + 1 + rng.int(0, Math.max(0, room.w - 3));
      let my = room.y + 1 + rng.int(0, Math.max(0, room.h - 3));
      let attempts = 0;
      while (mx === sx && my === sy && attempts < 8) {
        mx = room.x + 1 + rng.int(0, Math.max(0, room.w - 3));
        my = room.y + 1 + rng.int(0, Math.max(0, room.h - 3));
        attempts++;
      }
      spawns.push({
        x: mx,
        y: my,
        kind: 'mimic',
        params: { depth: floorPlan.depth },
      });
    }

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

    // Place tombstones in random rooms, avoiding solid features.
    for (const tombstoneData of tombstones) {
      const roomIdx = Math.floor(rng.next() * chunk.rooms.length);
      const room = chunk.rooms[roomIdx];
      if (!room) continue;
      const rngAny = /** @type {any} */ (rng);
      let tx, ty, tAttempts = 0;
      do {
        tx = room.x + 1 + rngAny.int(0, Math.max(0, room.w - 3));
        ty = room.y + 1 + rngAny.int(0, Math.max(0, room.h - 3));
        tAttempts++;
      } while (isSolid(tx, ty) && tAttempts < 10);
      if (!isSolid(tx, ty)) {
        markSolid(tx, ty);
        spawns.push({ x: tx, y: ty, kind: 'tombstone', params: tombstoneData });
      }
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

function isPointInRoom(x, y, room) {
  return x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h;
}

/**
 * Equip a monster entity with items defined in its equipment spec.
 * @param {import('../../../lib/ecs-js/index.js').World} world
 * @param {number} entityId
 * @param {{ranged?:string, ammo?:string}} equipment
 */
export function equipMonster(world, entityId, equipment) {
  const eq = world.get(entityId, Equipment);
  if (!eq) return;
  if (equipment.ranged) {
    const bowId = buildCatalogItem(world, equipment.ranged);
    eq.ranged = bowId;
  }
  if (equipment.ammo) {
    const arrowId = createFrom(world, ArrowsStack, {});
    eq.ammo = arrowId;
  }
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
      const id = spawnMonsterEntity(world, {
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
        creatureType: p.creatureType,
      });
      if (p.equipment) equipMonster(world, id, p.equipment);
      return id;
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
            try { world.remove(eid, Position); } catch {} // ECS: may not exist
            addToInventory(world, id, eid);
          }
        }
      }
      return id;
    }
    case 'mimic': {
      const id = createFrom(world, Chest, { x: spawn.x, y: spawn.y });
      world.add(id, Collider, { solid: true, blocksSight: false });
      world.add(id, Interactable, { action: 'touchMimic', params: null });
      world.add(id, Polymorph, {
        targetIdentity: 'mimic',
        trigger: 'touch',
        once: true,
        revealed: false,
        hookKey: 'mimic_touch',
        depth: Math.max(1, spawn.params?.depth | 0),
      });
      return id;
    }
    case 'trap': {
      const p = spawn.params;
      const arch = p.type === 'snake' ? SnakeTrap : p.type === 'shock' ? ShockTrap : SpikeTrap;
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

      return id;
    }
    case 'shop_item': {
      const depth = spawn.params.depth || 1;
      const shopRng = createRng(((world.seed >>> 0) ^ ((spawn.x * 0x9e3779b9) >>> 0) ^ (spawn.y * 0x45d9f3b) ^ 0x5470) >>> 0);

      // Generate exactly one item for this floor spawn (no orphan stock entities).
      const itemId = shopStock.generateShopItem(world, depth, shopRng);
      if (itemId == null) return null;

      // Place it on the floor
      world.add(itemId, Position, { x: spawn.x, y: spawn.y });

      // Shop items are pre-identified on the entity — no identify mask.
      const info = world.get(itemId, ItemInfo);
      if (info) {
        world.mutate(itemId, ItemInfo, r => { r.identified = true; });
      }

      // Calculate price (will be added as Unpaid in post-processing)
      if (info) {
        const baseValue = appraiseItemValue(world, itemId, {
          unidentifiedGemValue: getUnidentifiedGemAppraisal(world, itemId),
        });
        const price = Math.ceil(baseValue * 1.3); // 30% markup
        // Store price temporarily in spawn params for post-processing
        spawn._calculatedPrice = price;
        spawn._itemId = itemId;
      }

      return itemId;
    }
    case 'alchemy_shop_item': {
      const shopRng = createRng(((world.seed >>> 0) ^ ((spawn.x * 0x9e3779b9) >>> 0) ^ (spawn.y * 0x45d9f3b) ^ 0xA1C8) >>> 0);

      const itemId = shopStock.generateAlchemyShopItem(world, shopRng);
      if (itemId == null) return null;

      world.add(itemId, Position, { x: spawn.x, y: spawn.y });

      const info = world.get(itemId, ItemInfo);
      if (info) {
        world.mutate(itemId, ItemInfo, r => { r.identified = true; });
      }

      if (info) {
        const baseValue = appraiseItemValue(world, itemId, {
          unidentifiedGemValue: getUnidentifiedGemAppraisal(world, itemId),
        });
        const price = Math.ceil(baseValue * 1.3);
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
    case 'harvest_thorn_bramble':
      return createFrom(world, ThornBramble, { x: spawn.x, y: spawn.y });
    case 'harvest_venom_fern':
      return createFrom(world, VenomFern, { x: spawn.x, y: spawn.y });
    case 'harvest_moonleaf':
      return createFrom(world, MoonleafCluster, { x: spawn.x, y: spawn.y });
    case 'harvest_ember_root':
      return createFrom(world, EmberRootPatch, { x: spawn.x, y: spawn.y });
    case 'harvest_iron_ore':
      return createFrom(world, OreVeinIron, { x: spawn.x, y: spawn.y });
    case 'harvest_coal_ore':
      return createFrom(world, OreVeinCoal, { x: spawn.x, y: spawn.y });
    case 'harvest_stone':
      return createFrom(world, OreVeinStone, { x: spawn.x, y: spawn.y });
    case 'tree_node':
      return createFrom(world, TreeNode, { x: spawn.x, y: spawn.y });
    case 'alchemy_bench':
      return createFrom(world, AlchemyBench, { x: spawn.x, y: spawn.y });
    case 'anvil':
      return createFrom(world, Anvil, { x: spawn.x, y: spawn.y });
    case 'furnace':
      return createFrom(world, Furnace, { x: spawn.x, y: spawn.y });
    case 'cooking_fire':
      return createFrom(world, CookingFire, { x: spawn.x, y: spawn.y });
    case 'crop_wheat':
      return createFrom(world, CropWheat, { x: spawn.x, y: spawn.y });
    case 'crop_carrot':
      return createFrom(world, CropCarrot, { x: spawn.x, y: spawn.y });
    case 'crop_corn':
      return createFrom(world, CropCorn, { x: spawn.x, y: spawn.y });
    case 'well':
      return createFrom(world, Well, { x: spawn.x, y: spawn.y });
    case 'scarecrow':
      return createFrom(world, Scarecrow, { x: spawn.x, y: spawn.y });
    case 'tavern_keg':
      return createFrom(world, TavernKeg, { x: spawn.x, y: spawn.y });
    case 'tavern_table':
      return createFrom(world, TavernTable, { x: spawn.x, y: spawn.y });
    case 'tavern_bench':
      return createFrom(world, TavernBench, { x: spawn.x, y: spawn.y });
    case 'tavern_pillar':
      return createFrom(world, TavernPillar, { x: spawn.x, y: spawn.y });
    case 'tavern_sign':
      return createFrom(world, TavernSign, { x: spawn.x, y: spawn.y });
    case 'millstone':
      return createFrom(world, Millstone, { x: spawn.x, y: spawn.y });
    case 'church_altar':
      return createFrom(world, ChurchAltar, { x: spawn.x, y: spawn.y });
    case 'church_pew':
      return createFrom(world, ChurchPew, { x: spawn.x, y: spawn.y });
    case 'church_sign':
      return createFrom(world, ChurchSign, { x: spawn.x, y: spawn.y });
    case 'church_font':
      return createFrom(world, ChurchFont, { x: spawn.x, y: spawn.y });
    case 'church_window':
      return createFrom(world, ChurchWindow, { x: spawn.x, y: spawn.y });
    case 'window_arched':
      return createFrom(world, WindowArched, { x: spawn.x, y: spawn.y });
    case 'window_iron_grate':
      return createFrom(world, WindowIronGrate, { x: spawn.x, y: spawn.y });
    case 'window_shuttered':
      return createFrom(world, WindowShuttered, { x: spawn.x, y: spawn.y });
    case 'window_round':
      return createFrom(world, WindowRound, { x: spawn.x, y: spawn.y });
    case 'window_rect':
      return createFrom(world, WindowRect, { x: spawn.x, y: spawn.y });
    case 'town_bell':
      return createFrom(world, TownBell, { x: spawn.x, y: spawn.y });
    case 'flower_rose':
      return createFrom(world, FlowerRose, { x: spawn.x, y: spawn.y });
    case 'flower_sunflower':
      return createFrom(world, FlowerSunflower, { x: spawn.x, y: spawn.y });
    case 'flower_tulip':
      return createFrom(world, FlowerTulip, { x: spawn.x, y: spawn.y });
    case 'flower_daisy':
      return createFrom(world, FlowerDaisy, { x: spawn.x, y: spawn.y });
    case 'flower_bluebell':
      return createFrom(world, FlowerBluebell, { x: spawn.x, y: spawn.y });
    case 'smithy_chest':
      return createFrom(world, SmithyChest, { x: spawn.x, y: spawn.y });
    case 'mill_chest':
      return createFrom(world, MillChest, { x: spawn.x, y: spawn.y });
    case 'lumber_chest':
      return createFrom(world, LumberChest, { x: spawn.x, y: spawn.y });
    case 'smithy_sign':
      return createFrom(world, SmithySign, { x: spawn.x, y: spawn.y });
    case 'potion_shelf':
      return stockDisplayContainer(world, createFrom(world, PotionShelf, { x: spawn.x, y: spawn.y }), spawn, "alchemy");
    case 'herb_chest':
      return createFrom(world, HerbChest, { x: spawn.x, y: spawn.y });
    case 'tavern_chest':
      return createFrom(world, TavernChest, { x: spawn.x, y: spawn.y });
    case 'apothecary_sign':
      return createFrom(world, ApothecarySign, { x: spawn.x, y: spawn.y });
    case 'gem_shop_sign':
      return createFrom(world, GemShopSign, { x: spawn.x, y: spawn.y });
    case 'gem_display_case':
      return stockDisplayContainer(world, createFrom(world, GemDisplayCase, { x: spawn.x, y: spawn.y }), spawn, "gem");
    case 'message_board':
      return createFrom(world, MessageBoard, { x: spawn.x, y: spawn.y });
    case 'grave_tombstone':
      return createFrom(world, GraveTombstone, { x: spawn.x, y: spawn.y });
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
    // Town decorations
    case 'barrel':
      return createFrom(world, Barrel, { x: spawn.x, y: spawn.y });
    case 'crate':
      return createFrom(world, Crate, { x: spawn.x, y: spawn.y });
    case 'woodpile':
      return createFrom(world, Woodpile, { x: spawn.x, y: spawn.y });
    case 'hay_bale':
      return createFrom(world, HayBale, { x: spawn.x, y: spawn.y });
    case 'lantern_post':
      return createFrom(world, LanternPost, { x: spawn.x, y: spawn.y });
    case 'rain_barrel':
      return createFrom(world, RainBarrel, { x: spawn.x, y: spawn.y });
    case 'wheelbarrow':
      return createFrom(world, Wheelbarrow, { x: spawn.x, y: spawn.y });
    case 'market_stall':
      return createFrom(world, MarketStall, { x: spawn.x, y: spawn.y });
    case 'bench':
      return createFrom(world, Bench, { x: spawn.x, y: spawn.y });
    // Natural features
    case 'boulder':
      return createFrom(world, Boulder, { x: spawn.x, y: spawn.y });
    case 'fallen_log':
      return createFrom(world, FallenLog, { x: spawn.x, y: spawn.y });
    case 'lily_pad':
      return createFrom(world, LilyPad, { x: spawn.x, y: spawn.y });
    case 'cattail':
      return createFrom(world, Cattail, { x: spawn.x, y: spawn.y });
    // Garden features
    case 'birdbath':
      return createFrom(world, Birdbath, { x: spawn.x, y: spawn.y });
    case 'trellis':
      return createFrom(world, Trellis, { x: spawn.x, y: spawn.y });
    // Room features
    case 'fountain':
      return createFrom(world, Fountain, { x: spawn.x, y: spawn.y });
    case 'altar':
      return createFrom(world, Altar, { x: spawn.x, y: spawn.y });
    case 'shrine':
      return createFrom(world, Shrine, { x: spawn.x, y: spawn.y });
    case 'statue':
      return createFrom(world, Statue, { x: spawn.x, y: spawn.y });
    case 'sarcophagus':
      return createFrom(world, Sarcophagus, { x: spawn.x, y: spawn.y, depth: /** @type {any} */ (spawn.params)?.depth || 1 });
    case 'pillar':
      return createFrom(world, Pillar, { x: spawn.x, y: spawn.y });
    case 'weapon_rack': {
      const id = createFrom(world, WeaponRack, { x: spawn.x, y: spawn.y });
      const d = /** @type {any} */ (spawn.params)?.depth || 1;
      const tableId = d >= 8 ? 'rack:weapons:magic' : 'rack:weapons';
      const rackSeed = ((world.seed >>> 0) ^ ((id * 0x9e3779b9) >>> 0) ^ 0xBAC5) >>> 0;
      const rackRng = createRng(rackSeed);
      const drops = resolveLootTable(tableId, rackRng, d);
      const inv = /** @type {any} */ (world.get(id, Inventory));
      if (inv) {
        for (const drop of drops) {
          const eid = materializeDrop(world, drop, { x: spawn.x, y: spawn.y });
          if (eid != null) {
            try { world.remove(eid, Position); } catch {}
            addToInventory(world, id, eid);
          }
        }
      }
      return id;
    }
    case 'mushrooms':
      return createFrom(world, Mushrooms, { x: spawn.x, y: spawn.y });
    case 'web':
      return createFrom(world, Web, { x: spawn.x, y: spawn.y });
    case 'torch':
      return createFrom(world, Torch, { x: spawn.x, y: spawn.y });
    case 'urn':
      return createFrom(world, Urn, { x: spawn.x, y: spawn.y });
    case 'tile_paint': {
      const tiles = /** @type {any} */ (spawn.params)?.tiles;
      if (Array.isArray(tiles)) {
        for (const t of tiles) {
          // Only paint over floor tiles to avoid overwriting doors/stairs
          if (getTile(t.x, t.y) === TILE_FLOOR) setTile(t.x, t.y, t.tile);
        }
      }
      return null;
    }
    case 'townfolk': {
      const def = TOWNFOLK[spawn.params.townfolkId];
      if (!def) return null;
      const homeX = Number.isFinite(spawn.params.homeX) ? spawn.params.homeX : spawn.x;
      const homeY = Number.isFinite(spawn.params.homeY) ? spawn.params.homeY : spawn.y;
      const bedX = Number.isFinite(spawn.params.bedX) ? spawn.params.bedX : homeX;
      const bedY = Number.isFinite(spawn.params.bedY) ? spawn.params.bedY : homeY;
      const workX = Number.isFinite(spawn.params.workX) ? spawn.params.workX : spawn.x;
      const workY = Number.isFinite(spawn.params.workY) ? spawn.params.workY : spawn.y;
      const workAuxX = Number.isFinite(spawn.params.workAuxX) ? spawn.params.workAuxX : workX;
      const workAuxY = Number.isFinite(spawn.params.workAuxY) ? spawn.params.workAuxY : workY;
      const pubX = Number.isFinite(spawn.params.pubX) ? spawn.params.pubX : homeX;
      const pubY = Number.isFinite(spawn.params.pubY) ? spawn.params.pubY : homeY;
      const deliverX = Number.isFinite(spawn.params.deliverX) ? spawn.params.deliverX : 0;
      const deliverY = Number.isFinite(spawn.params.deliverY) ? spawn.params.deliverY : 0;
      const id = createFrom(world, Human, {
        x: spawn.x,
        y: spawn.y,
        name: def.name,
        identity: def.identity,
        faction: "townfolk",
        maxHp: def.maxHp,
        speed: def.speed,
        capacity: 6,
        intelligence: 10,
      });
      world.add(id, TownfolkJob, {
        role: def.role,
        state: "idle",
        scheduleEnabled: Boolean(spawn.params.scheduleEnabled),
        homeX,
        homeY,
        bedX,
        bedY,
        workX,
        workY,
        workAuxX,
        workAuxY,
        pubX,
        pubY,
        targetX: homeX,
        targetY: homeY,
        workTurns: 0,
        idleTurns: 2 + Math.floor((world.rand?.() ?? 0) * 5),
        workSiteKind: "",
        routineKind: "",
        lastPhase: "",
        carrying: "",
        carryCount: 0,
        carryMax: def.role === "farmer" ? 4 : def.role === "herbalist" ? 3 : 0,
        deliverX,
        deliverY,
        stuckTurns: 0,
      });
      // Alchemist is a shopkeeper — use openShop action instead of talkToNPC
      if (def.role === "alchemist") {
        world.add(id, Interactable, {
          action: "openShop",
          params: { dialogue: def.dialogue, townfolkId: spawn.params.townfolkId },
        });
        world.add(id, ShopInventory, { buyMarkup: 1.3, sellDiscount: 0.5 });
        assignShopDoorKey(world, id, spawn.params.shopDoorRole || def.role, spawn.params.shopDoor);
        if (spawn.params.shopRoom) {
          const roomEntity = world.create();
          world.add(roomEntity, RoomMetadata, {
            roomType: 'shop',
            x: spawn.params.shopRoom.x,
            y: spawn.params.shopRoom.y,
            w: spawn.params.shopRoom.w,
            h: spawn.params.shopRoom.h,
            shopkeeperId: id,
          });
        }
      } else if (def.role === "gem_vendor") {
        world.add(id, Interactable, {
          action: "openGemVendor",
          params: { dialogue: def.dialogue, townfolkId: spawn.params.townfolkId },
        });
        world.add(id, ShopInventory, { buyMarkup: 1.5, sellDiscount: 0.5 });
        assignShopDoorKey(world, id, spawn.params.shopDoorRole || def.role, spawn.params.shopDoor);
        if (spawn.params.shopRoom) {
          const roomEntity = world.create();
          world.add(roomEntity, RoomMetadata, {
            roomType: 'shop',
            x: spawn.params.shopRoom.x,
            y: spawn.params.shopRoom.y,
            w: spawn.params.shopRoom.w,
            h: spawn.params.shopRoom.h,
            shopkeeperId: id,
          });
          // Pre-stock gem shop with gem items placed inside the shop room
          const gemRng = createRng(((world.seed >>> 0) ^ (spawn.x * 0x9e3779b9) ^ (spawn.y * 0x1f2d3c4e)) >>> 0);
          const gemItems = shopStock.generateGemShopStock(world, gemRng);
          const sr = spawn.params.shopRoom;
          for (let gi = 0; gi < gemItems.length; gi++) {
            const itemId = gemItems[gi];
            // Place items in a row inside the shop room
            const px = sr.x + 1 + (gi % Math.max(1, sr.w - 2));
            const py = sr.y + 1 + Math.floor(gi / Math.max(1, sr.w - 2));
            world.add(itemId, Position, { x: px, y: py });
            const info = world.get(itemId, ItemInfo);
            const price = info ? Math.ceil(Number(info.value || 50) * 1.5) : 50;
            try { world.add(itemId, Unpaid, { shopkeeperId: id, price }); } catch {}
          }
        }
      } else {
        world.add(id, Interactable, {
          action: "talkToNPC",
          params: {
            dialogue: def.dialogue,
            townfolkId: spawn.params.townfolkId,
            dialogId: `townfolk:${def.role}`,
          },
        });
        if (spawn.params.shopDoor) {
          assignShopDoorKey(world, id, spawn.params.shopDoorRole || def.role, spawn.params.shopDoor);
        }
      }
      // Miner spawns with pickaxe equipped
      if (def.role === "miner") {
        const pickId = createItemById(world, "iron_pickaxe");
        if (pickId) {
          addToInventory(world, id, pickId);
          const eq = world.get(id, Equipment);
          if (eq) eq.weapon = pickId;
        }
      }
      if (def.role === "woodcutter") {
        const hatchetId = createItemById(world, "tool_hatchet");
        if (hatchetId) {
          addToInventory(world, id, hatchetId);
          const eq = world.get(id, Equipment);
          if (eq) eq.weapon = hatchetId;
        }
      }
      return id;
    }
    default:
      return null;
  }
}
