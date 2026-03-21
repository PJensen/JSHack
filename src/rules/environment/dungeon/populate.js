// rules/environment/dungeon/populate.js
// Generate spawn points for a chunk based on rooms and depth.

import { createRng } from '../../../lib/ecs-js/rng.js';
import { createFrom } from '../../../lib/ecs-js/archetype.js';
import { Position } from '../../components/Position.js';
import { NamedIdentity } from '../../components/NamedIdentity.js';
import { ItemInfo } from '../../components/ItemInfo.js';
import { Interactable } from '../../components/Interactable.js';
import { Collider } from '../../components/Collider.js';
import TombstoneComponent from '../../components/Tombstone.js';
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
import { pickMonster, pickSentinelMonster, pickItem, pickTrap, pickSpawner, pickSpecificMonster, pickSpecificSpawner, pickEncounterGroup } from './tables.js';
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
  BookShopSign,
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
import { getMonster } from '../../data/monsters.js';
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
import { spawnCentipede } from '../../utils/spawnCentipede.js';
import {
  Fountain, Altar, Shrine, Statue,
  Sarcophagus, Pillar, WeaponRack, Mushrooms, Web, Torch, Urn,
} from '../../archetypes/RoomFeatures.js';

// Simple spawn kinds: just `createFrom(world, Archetype, { x, y })` with no extra logic.
const SIMPLE_SPAWN_TABLE = {
  home_bed: HomeBed, home_chest: HomeChest, home_sign: HomeSign,
  harvest_berries: BerryBush, harvest_herbs: HerbPatch,
  harvest_thorn_bramble: ThornBramble, harvest_venom_fern: VenomFern,
  harvest_moonleaf: MoonleafCluster, harvest_ember_root: EmberRootPatch,
  harvest_iron_ore: OreVeinIron, harvest_coal_ore: OreVeinCoal,
  harvest_stone: OreVeinStone, tree_node: TreeNode,
  alchemy_bench: AlchemyBench, anvil: Anvil, furnace: Furnace,
  cooking_fire: CookingFire,
  crop_wheat: CropWheat, crop_carrot: CropCarrot, crop_corn: CropCorn,
  well: Well, scarecrow: Scarecrow,
  tavern_keg: TavernKeg, tavern_table: TavernTable, tavern_bench: TavernBench,
  tavern_pillar: TavernPillar, tavern_sign: TavernSign,
  millstone: Millstone,
  church_altar: ChurchAltar, church_pew: ChurchPew, church_sign: ChurchSign,
  church_font: ChurchFont, church_window: ChurchWindow,
  window_arched: WindowArched, window_iron_grate: WindowIronGrate,
  window_shuttered: WindowShuttered, window_round: WindowRound, window_rect: WindowRect,
  town_bell: TownBell,
  flower_rose: FlowerRose, flower_sunflower: FlowerSunflower,
  flower_tulip: FlowerTulip, flower_daisy: FlowerDaisy, flower_bluebell: FlowerBluebell,
  smithy_chest: SmithyChest, mill_chest: MillChest, lumber_chest: LumberChest,
  smithy_sign: SmithySign, herb_chest: HerbChest, tavern_chest: TavernChest,
  apothecary_sign: ApothecarySign, gem_shop_sign: GemShopSign, book_shop_sign: BookShopSign,
  message_board: MessageBoard,
  barrel: Barrel, crate: Crate, woodpile: Woodpile, hay_bale: HayBale,
  lantern_post: LanternPost, rain_barrel: RainBarrel, wheelbarrow: Wheelbarrow,
  market_stall: MarketStall, bench: Bench,
  boulder: Boulder, fallen_log: FallenLog, lily_pad: LilyPad, cattail: Cattail,
  birdbath: Birdbath, trellis: Trellis,
  fountain: Fountain, altar: Altar, shrine: Shrine, statue: Statue, pillar: Pillar,
  mushrooms: Mushrooms, web: Web, torch: Torch, urn: Urn,
};

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
const DEAD_END_ROOM_THEMES = [
  { kind: 'treasure', weight: 14 },
  { kind: 'trapped_treasure', weight: 8 },
  { kind: 'sanctuary', weight: 6 },
  { kind: 'lore_nook', weight: 5 },
  { kind: 'lair', weight: 5 },
];
const DEAD_END_THEME_TOTAL_WEIGHT = DEAD_END_ROOM_THEMES.reduce((s, f) => s + f.weight, 0);
const SHOP_MIMIC_CHANCE = 0.08;
const SHOP_MAX_ROOM_WIDTH = 6;
const SHOP_MAX_ROOM_HEIGHT = 6;
const DEAD_END_CONTENT_CHANCE = 1.0;
const DISPLAY_CONTAINER_IDENTITIES = new Set(["potion_shelf", "gem_display_case"]);

function findDoorEntityAt(world, x, y) {
  for (const [id, pos] of world.query(Position, DoorState)) {
    if (pos.x === x && pos.y === y) return id;
  }
  return 0;
}

const SHOP_KEY_META = {
  gem_vendor:  { label: "Gem Shop Key",  identity: "key_gem_shop",   desc: "the gem shop" },
  alchemist:   { label: "Apothecary Key", identity: "key_apothecary", desc: "the apothecary" },
  book_vendor: { label: "Book Shop Key",  identity: "key_book_shop",  desc: "the book shop" },
};

function createShopDoorKey(world, lockId, role) {
  const itemId = world.create();
  const meta = SHOP_KEY_META[role] || { label: "Shop Key", identity: "key_shop", desc: "a shop" };
  world.add(itemId, NamedIdentity, { name: meta.label, identity: meta.identity });
  world.add(itemId, ItemInfo, {
    type: "tool",
    slot: "",
    weight: 0.1,
    value: 0,
    description: `A shop key cut for ${meta.desc} door.`,
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
    else if (stockKind === "gem") itemId = shopStock.generateGemDisplayItem(world, rng, {
      stockTier: spawn?.params?.stockTier || null,
    });
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

function pickDeadEndTheme(rng) {
  let roll = rng.next() * DEAD_END_THEME_TOTAL_WEIGHT;
  for (const theme of DEAD_END_ROOM_THEMES) {
    roll -= theme.weight;
    if (roll <= 0) return theme.kind;
  }
  return DEAD_END_ROOM_THEMES[DEAD_END_ROOM_THEMES.length - 1].kind;
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
  const eligibleDeadEndRooms = chunk.rooms.filter((room) => {
    const isDeadEnd = countRoomEntrances(room, chunk) === 1;
    const isEntryRoom = !!entryRoom &&
      room.x === entryRoom.x &&
      room.y === entryRoom.y &&
      room.w === entryRoom.w &&
      room.h === entryRoom.h;
    return isDeadEnd && !isEntryRoom;
  });
  const eligibleShopRooms = eligibleDeadEndRooms.filter((room) => (
    room.w <= SHOP_MAX_ROOM_WIDTH
    && room.h <= SHOP_MAX_ROOM_HEIGHT
    && countRoomOpeningTiles(room, chunk) === 1
  ));

  // Solid spawn kinds that should be marked solid in the solidPositions set.
  const SOLID_PREFAB_KINDS = new Set([
    'statue', 'urn', 'pillar', 'sarcophagus', 'fountain', 'altar', 'shrine',
  ]);

  for (const room of chunk.rooms) {
    // Prefab rooms use their own spawn list — skip normal population entirely.
    if (room.prefab && Array.isArray(room.prefabSpawns)) {
      for (const s of room.prefabSpawns) {
        const params = { ...(s.params || {}) };
        if (s.kind === "monster" && typeof params.monsterId === "string") {
          const resolved = pickSpecificMonster(params.monsterId, floorPlan.depth);
          if (!resolved) continue;
          spawns.push({ x: s.x, y: s.y, kind: "monster", params: resolved });
          continue;
        }
        spawns.push({ x: s.x, y: s.y, kind: s.kind, params });
        if (SOLID_PREFAB_KINDS.has(s.kind)) markSolid(s.x, s.y);
      }
      continue;
    }

    const area = room.w * room.h;

    // Place a room feature (~50% of non-entry rooms get one)
    const isEntryRoom = room === entryRoom;
    let roomHasWeaponRack = false;
    const featureRate = floorPlan.profile?.doorFeatureRate ?? 0.50;
    if (!isEntryRoom && rng.next() < featureRate) {
      const featureKind = _pickFeature(rng, floorPlan.profile?.featurePool ?? null);
      const cx = room.x + Math.floor(room.w / 2);
      const cy = room.y + Math.floor(room.h / 2);

      // For noise-generated floors, solid features must not block narrow passages.
      let skipFeature = false;
      if (floorPlan.profile?.generator && SOLID_PREFAB_KINDS.has(featureKind)) {
        const lx = cx - chunk.chunkX * CHUNK_SIZE;
        const ly = cy - chunk.chunkY * CHUNK_SIZE;
        const inBounds = lx >= 0 && ly >= 0 && lx < CHUNK_SIZE && ly < CHUNK_SIZE;
        if (!inBounds || chunk.tiles[ly * CHUNK_SIZE + lx] !== TILE_FLOOR) {
          skipFeature = true;
        } else {
          let floorN = 0;
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nx = lx + dx, ny = ly + dy;
            if (nx >= 0 && ny >= 0 && nx < CHUNK_SIZE && ny < CHUNK_SIZE
                && chunk.tiles[ny * CHUNK_SIZE + nx] === TILE_FLOOR) floorN++;
          }
          if (floorN < 3) skipFeature = true;
        }
      }

      // Don't place a feature on a stair (or any other already-solid tile).
      if (!skipFeature && !isSolid(cx, cy)) {
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

    // Rare room mimic: 5% chance per non-entry room to place a mimic disguised
    // as a common dungeon decoration. Uses a separate spawn point (not the feature).
    const ROOM_MIMIC_CHANCE = 0.05;
    const MIMIC_DISGUISE_POOL = ['chest', 'barrel', 'urn', 'crate', 'sarcophagus'];
    if (!isEntryRoom && rng.next() < ROOM_MIMIC_CHANCE) {
      let mx = room.x + 1 + rng.int(0, Math.max(0, room.w - 3));
      let my = room.y + 1 + rng.int(0, Math.max(0, room.h - 3));
      let attempts = 0;
      while (isSolid(mx, my) && attempts < 8) {
        mx = room.x + 1 + rng.int(0, Math.max(0, room.w - 3));
        my = room.y + 1 + rng.int(0, Math.max(0, room.h - 3));
        attempts++;
      }
      if (!isSolid(mx, my)) {
        const disguise = MIMIC_DISGUISE_POOL[rng.int(0, MIMIC_DISGUISE_POOL.length - 1)];
        spawns.push({
          x: mx, y: my,
          kind: 'mimic',
          params: { depth: floorPlan.depth, disguiseIdentity: disguise },
        });
        markSolid(mx, my);
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

    // Encounter group: ~20% chance to spawn a themed group instead of random individuals
    let groupBudgetUsed = 0;
    if (monsterBudget >= 2 && rng.next() < 0.20) {
      const group = pickEncounterGroup(rng, floorPlan.depth, monsterBudget);
      if (group) {
        const placeGroupMember = (params) => {
          if (groupBudgetUsed >= monsterBudget) return;
          let mx, my, att = 0;
          do {
            mx = room.x + 1 + rng.int(0, Math.max(0, room.w - 3));
            my = room.y + 1 + rng.int(0, Math.max(0, room.h - 3));
            att++;
          } while (isSolid(mx, my) && att < 10);
          if (!isSolid(mx, my)) {
            spawns.push({ x: mx, y: my, kind: 'monster', params });
            const id = params.identity;
            if (id === 'spider' || id === 'cave_spider' || id === 'phase_spider') roomHasSpider = true;
            groupBudgetUsed++;
          }
        };
        if (group.leader) placeGroupMember(group.leader);
        for (const follower of group.followers) placeGroupMember(follower);
      }
    }

    // Place remaining individual monsters — avoid solid features
    const remainingBudget = Math.max(0, monsterBudget - groupBudgetUsed);
    for (let i = 0; i < remainingBudget; i++) {
      let mx, my, attempts = 0;
      do {
        mx = room.x + 1 + rng.int(0, Math.max(0, room.w - 3));
        my = room.y + 1 + rng.int(0, Math.max(0, room.h - 3));
        attempts++;
      } while (isSolid(mx, my) && attempts < 10);
      if (isSolid(mx, my)) continue;
      const mp = pickSentinelMonster(rng, floorPlan.depth, floorPlan.profile?.monsterFilter ?? null);
      if (mp.identity === 'centipede') {
        const segCount = rng.int(4, 7);
        spawns.push({ x: mx, y: my, kind: 'centipede', params: { ...mp, segmentCount: segCount } });
      } else {
        spawns.push({ x: mx, y: my, kind: 'monster', params: mp });
      }
      if (mp.identity === 'spider' || mp.identity === 'cave_spider') roomHasSpider = true;
    }

    // Scatter webs across ~30% of floor tiles in spider rooms.
    // Don't place webs on non-spider spawners; spider spawners are the exception.
    if (roomHasSpider) {
      for (let wy = room.y + 1; wy < room.y + room.h - 1; wy++) {
        for (let wx = room.x + 1; wx < room.x + room.w - 1; wx++) {
          if (rng.next() < 0.30) {
            const spawnerHere = roomSpawners.find(s => s.x === wx && s.y === wy);
            if ((!spawnerHere || spawnerHere.isSpider) && !isSolid(wx, wy)) {
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
      if (isSolid(ix, iy)) continue;
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
        const cr = rng.next();
        const tableId = (d >= 14 || cr < 0.02) ? 'chest:legendary'
                      : (d >= 10 || cr < 0.08) ? 'chest:epic'
                      : (d >= 8  || cr < 0.15) ? 'chest:magic'
                      : 'chest:basic';
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

  // Hallway monsters: lone wanderers in corridors (floor tiles outside any room).
  // ~8% of corridor tiles are candidates; place 1-3 per chunk.
  {
    const ox = chunk.chunkX * CHUNK_SIZE;
    const oy = chunk.chunkY * CHUNK_SIZE;
    const corridorCandidates = [];
    for (let ly = 1; ly < CHUNK_SIZE - 1; ly++) {
      for (let lx = 1; lx < CHUNK_SIZE - 1; lx++) {
        const t = chunk.tiles[ly * CHUNK_SIZE + lx];
        if (t !== TILE_FLOOR) continue;
        const wx = ox + lx;
        const wy = oy + ly;
        if (isSolid(wx, wy)) continue;
        // Skip tiles inside any room
        let inRoom = false;
        for (const room of chunk.rooms) {
          if (wx >= room.x && wx < room.x + room.w && wy >= room.y && wy < room.y + room.h) {
            inRoom = true;
            break;
          }
        }
        if (!inRoom) corridorCandidates.push({ x: wx, y: wy });
      }
    }
    const hallwayCap = floorPlan.profile?.hallwayMonsterCap ?? 3;
    const hallwayBudget = Math.min(hallwayCap, Math.floor(corridorCandidates.length * 0.08));
    for (let i = 0; i < hallwayBudget && corridorCandidates.length > 0; i++) {
      const idx = rng.int(0, corridorCandidates.length - 1);
      const pos = corridorCandidates.splice(idx, 1)[0];
      const mp = pickSentinelMonster(rng, floorPlan.depth, floorPlan.profile?.monsterFilter ?? null);
      if (mp.identity === 'centipede') {
        const segCount = rng.int(4, 7);
        spawns.push({ x: pos.x, y: pos.y, kind: 'centipede', params: { ...mp, segmentCount: segCount } });
      } else {
        spawns.push({ x: pos.x, y: pos.y, kind: 'monster', params: mp });
      }
    }

    // Grotto trap scatter: noise-generated floors have tiny synthetic rooms, so
    // the per-room trap logic barely places any. Scatter traps across the open
    // cave floor using leftover corridor candidates.
    if (floorPlan.profile?.generator && corridorCandidates.length > 0) {
      const trapScatterBudget = Math.floor(corridorCandidates.length * 0.012);
      for (let i = 0; i < trapScatterBudget && corridorCandidates.length > 0; i++) {
        const idx = rng.int(0, corridorCandidates.length - 1);
        const pos = corridorCandidates.splice(idx, 1)[0];
        const trap = pickTrap(rng, floorPlan.depth);
        spawns.push({ x: pos.x, y: pos.y, kind: 'trap', params: trap });
      }
    }
  }

  // Depth 1 guaranteed content: skeleton archer, a rare monster,
  // and two mixed vermin/humanoid nests to preserve rat fodder and variety.
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

      // Guaranteed mixed spawners (2 nests, preserving rat fodder and adding variety)
      const verminIds = ['rat', 'cave_spider', 'goblin'];
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
                if (rng.next() < 0.30 && !isSolid(wx, wy)) {
                  spawns.push({ x: wx, y: wy, kind: 'web', params: {} });
                }
              }
            }
          }
        }
      }
    }
  }

  // Shopkeeper: one per chunk, only in small dead-end rooms (exactly one perimeter entrance), ~30% chance.
  // Extra rule: never use the origin chunk's spawn room (rooms[0] in chunk 0,0).
  const shopChance = floorPlan.profile?.shopChance ?? 0.30;
  let shopRoom = null;
  if (eligibleShopRooms.length > 0 && rng.next() < shopChance) {
    shopRoom = eligibleShopRooms[rng.int(0, eligibleShopRooms.length - 1)];
  }
  if (shopRoom) {
    const room = shopRoom;

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

  for (const room of eligibleDeadEndRooms) {
    if (shopRoom && room.x === shopRoom.x && room.y === shopRoom.y && room.w === shopRoom.w && room.h === shopRoom.h) {
      continue;
    }
    if (rng.next() >= DEAD_END_CONTENT_CHANCE) continue;

    const theme = pickDeadEndTheme(rng);
    applyDeadEndTheme({
      room,
      rng,
      spawns,
      floorPlan,
      chunk,
      isSolid,
      markSolid,
      theme,
    });
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
    if (!isSolid(bx, by)) {
      spawns.push({ x: bx, y: by, kind: 'book', params: { bookId: book.id } });
    }
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
 * Count perimeter floor tiles in a room that open directly into passable non-room space.
 * Shops require exactly one opening tile to guarantee a true single-entry dead end.
 * @param {{x:number,y:number,w:number,h:number}} room
 * @param {{chunkX:number,chunkY:number,tiles:Uint8Array}} chunk
 * @returns {number}
 */
function countRoomOpeningTiles(room, chunk) {
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

  function roomHas(x, y) {
    return x >= rx && x < rx + rw && y >= ry && y < ry + rh;
  }

  let openings = 0;
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      const isPerimeter = (x === rx || x === rx + rw - 1 || y === ry || y === ry + rh - 1);
      if (!isPerimeter) continue;
      if (!isPassable(getTile(x, y))) continue;

      const neighbors = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ];

      let opensOut = false;
      for (const [nx, ny] of neighbors) {
        if (roomHas(nx, ny)) continue;
        if (isPassable(getTile(nx, ny))) {
          opensOut = true;
          break;
        }
      }
      if (opensOut) openings++;
    }
  }

  return openings;
}

function isPointInRoom(x, y, room) {
  return x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h;
}

function isSameRoom(a, b) {
  return !!a && !!b
    && a.x === b.x
    && a.y === b.y
    && a.w === b.w
    && a.h === b.h;
}

function removeRoomSpawns(spawns, room, predicate) {
  for (let i = spawns.length - 1; i >= 0; i--) {
    const spawn = spawns[i];
    if (!isPointInRoom(spawn.x, spawn.y, room)) continue;
    if (predicate(spawn)) spawns.splice(i, 1);
  }
}

function pickRoomInteriorSpot(room, rng, isBlocked, reserved = new Set(), tries = 16) {
  if (room.w <= 2 || room.h <= 2) return null;
  for (let attempt = 0; attempt < tries; attempt++) {
    const x = room.x + 1 + rng.int(0, Math.max(0, room.w - 3));
    const y = room.y + 1 + rng.int(0, Math.max(0, room.h - 3));
    const key = `${x},${y}`;
    if (reserved.has(key)) continue;
    if (isBlocked(x, y)) continue;
    reserved.add(key);
    return { x, y };
  }

  const fallbackX = room.x + Math.floor(room.w / 2);
  const fallbackY = room.y + Math.floor(room.h / 2);
  const fallbackKey = `${fallbackX},${fallbackY}`;
  if (!reserved.has(fallbackKey) && !isBlocked(fallbackX, fallbackY)) {
    reserved.add(fallbackKey);
    return { x: fallbackX, y: fallbackY };
  }
  return null;
}

function applyDeadEndTheme(ctx) {
  const { room, rng, spawns, floorPlan, isSolid, markSolid, theme } = ctx;
  const reserved = new Set();

  switch (theme) {
    case 'treasure': {
      const chestPos = pickRoomInteriorSpot(room, rng, isSolid, reserved);
      if (chestPos) {
        markSolid(chestPos.x, chestPos.y);
        spawns.push({
          x: chestPos.x,
          y: chestPos.y,
          kind: 'chest',
          params: { depth: floorPlan.depth, lootTable: floorPlan.depth >= 8 ? 'chest:magic' : 'chest:basic' },
        });
      }
      const goldPos = pickRoomInteriorSpot(room, rng, isSolid, reserved);
      if (goldPos) {
        spawns.push({
          x: goldPos.x,
          y: goldPos.y,
          kind: 'gold',
          params: { count: rng.int(12, 36) + floorPlan.depth * 3 },
        });
      }
      break;
    }
    case 'trapped_treasure': {
      const chestPos = pickRoomInteriorSpot(room, rng, isSolid, reserved);
      if (chestPos) {
        markSolid(chestPos.x, chestPos.y);
        spawns.push({
          x: chestPos.x,
          y: chestPos.y,
          kind: 'chest',
          params: { depth: floorPlan.depth, lootTable: floorPlan.depth >= 6 ? 'chest:magic' : 'chest:basic' },
        });
      }
      const trapPos = pickRoomInteriorSpot(room, rng, isSolid, reserved);
      if (trapPos) {
        spawns.push({
          x: trapPos.x,
          y: trapPos.y,
          kind: 'trap',
          params: pickTrap(rng, floorPlan.depth),
        });
      }
      break;
    }
    case 'sanctuary': {
      removeRoomSpawns(spawns, room, (spawn) => spawn.kind === 'monster' || spawn.kind === 'spawner' || spawn.kind === 'trap');
      const featureRoll = rng.next();
      const sanctuaryKind = featureRoll < 0.34 ? 'fountain' : (featureRoll < 0.67 ? 'shrine' : 'altar');
      const featurePos = pickRoomInteriorSpot(room, rng, isSolid, reserved);
      if (featurePos) {
        markSolid(featurePos.x, featurePos.y);
        spawns.push({ x: featurePos.x, y: featurePos.y, kind: sanctuaryKind, params: { depth: floorPlan.depth } });
      }
      const itemPos = pickRoomInteriorSpot(room, rng, isSolid, reserved);
      if (itemPos) {
        const item = pickItem(rng, floorPlan.depth);
        spawns.push({ x: itemPos.x, y: itemPos.y, kind: item.kind, params: item });
      }
      break;
    }
    case 'lore_nook': {
      const statuePos = pickRoomInteriorSpot(room, rng, isSolid, reserved);
      if (statuePos) {
        markSolid(statuePos.x, statuePos.y);
        spawns.push({ x: statuePos.x, y: statuePos.y, kind: rng.next() < 0.5 ? 'statue' : 'urn', params: { depth: floorPlan.depth } });
      }
      const bookPos = pickRoomInteriorSpot(room, rng, isSolid, reserved);
      if (bookPos) {
        const book = pickDungeonBook(rng);
        spawns.push({ x: bookPos.x, y: bookPos.y, kind: 'book', params: { bookId: book.id } });
      }
      break;
    }
    case 'lair': {
      const chestPos = pickRoomInteriorSpot(room, rng, isSolid, reserved);
      if (chestPos) {
        markSolid(chestPos.x, chestPos.y);
        spawns.push({
          x: chestPos.x,
          y: chestPos.y,
          kind: 'chest',
          params: { depth: floorPlan.depth, lootTable: floorPlan.depth >= 8 ? 'chest:magic' : 'chest:basic' },
        });
      }
      const monsterPos = pickRoomInteriorSpot(room, rng, isSolid, reserved);
      if (monsterPos) {
        const gmp = pickMonster(rng, floorPlan.depth, floorPlan.profile?.monsterFilter ?? null);
        if (gmp.identity === 'centipede') {
          const segCount = rng.int(4, 7);
          spawns.push({ x: monsterPos.x, y: monsterPos.y, kind: 'centipede', params: { ...gmp, segmentCount: segCount } });
        } else {
          spawns.push({ x: monsterPos.x, y: monsterPos.y, kind: 'monster', params: gmp });
        }
      }
      break;
    }
  }
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
  const identity = String(world.get(entityId, NamedIdentity)?.identity || '');
  const def = identity ? getMonster(identity) : null;
  if (def && (!Array.isArray(def.tags) || !def.tags.includes('humanoid'))) return;
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
  // Fast path: trivial spawn kinds that are just createFrom(arch, { x, y }).
  const simpleArch = SIMPLE_SPAWN_TABLE[spawn.kind];
  if (simpleArch) return createFrom(world, simpleArch, { x: spawn.x, y: spawn.y });

  switch (spawn.kind) {
    case 'monster': {
      const p = spawn.params;
      const id = spawnMonsterEntity(world, {
        x: spawn.x, y: spawn.y,
        name: p.name,
        identity: p.identity,
        maxHp: p.maxHp,
        faction: p.faction,
        accuracyDerived: p.accuracyDerived,
        damagePowerDerived: p.damagePowerDerived,
        evadeDerived: p.evadeDerived,
        naturalDamageDice: p.naturalDamageDice,
        naturalScript: p.naturalScript,
        sizeClass: p.sizeClass,
        massKg: p.massKg,
        resistances: p.resistances,
        speed: p.speed,
        learnedSpellIds: p.learnedSpellIds,
        maxMana: p.maxMana,
        manaRegen: p.manaRegen,
        creatureType: p.creatureType,
      });
      if (p.equipment) equipMonster(world, id, p.equipment);
      return id;
    }
    case 'centipede': {
      const p = spawn.params;
      const seed = ((world.seed >>> 0) ^ ((spawn.x * 0x45d9f3b) >>> 0) ^ ((spawn.y * 0x119de1f3) >>> 0)) >>> 0;
      const cRng = createRng(seed);
      const ids = spawnCentipede(world, p, spawn.x, spawn.y, p.segmentCount || 5, cRng);
      return ids[0];
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
      // Set identity to reflect rarity tier so palette and glow effects can key off it
      const ni = world.get(id, NamedIdentity);
      if (ni) {
        if (lootTable === 'chest:legendary') { ni.identity = 'legendary_chest'; ni.name = 'Legendary Chest'; }
        else if (lootTable === 'chest:epic') { ni.identity = 'epic_chest'; ni.name = 'Epic Chest'; }
        else if (lootTable === 'chest:magic') { ni.identity = 'magic_chest'; ni.name = 'Magic Chest'; }
        else { ni.identity = 'basic_chest'; }
      }
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
      // Resolve disguise archetype — defaults to Chest (shop mimics)
      const disguise = String(spawn.params?.disguiseIdentity || 'chest');
      const DisguiseArch = SIMPLE_SPAWN_TABLE[disguise] || Chest;
      const id = createFrom(world, DisguiseArch, { x: spawn.x, y: spawn.y });
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
      // Create spawner with specific identity for display palette lookup.
      // Starts dormant — monsterSpawnerSystem activates once area is explored.
      return createFrom(world, Spawner, {
        x: spawn.x,
        y: spawn.y,
        name: `${monsterParams.name} Nest`,
        identity: 'spawner',  // Used by display layer to lookup glyph/color
        spawnParams: monsterParams,
        totalToSpawn: p.packSize,
        cooldownTicks: p.cooldownTicks ?? 15,
        maxConcurrent: p.maxConcurrent ?? 3,
        spawnRadius: 2,
        isActive: false,       // dormant until explored
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
    case 'potion_shelf':
      return stockDisplayContainer(world, createFrom(world, PotionShelf, { x: spawn.x, y: spawn.y }), spawn, "alchemy");
    case 'gem_display_case':
      return stockDisplayContainer(world, createFrom(world, GemDisplayCase, { x: spawn.x, y: spawn.y }), spawn, "gem");
    case 'book_shop_item': {
      const shopRng = createRng(((world.seed >>> 0) ^ ((spawn.x * 0x9e3779b9) >>> 0) ^ (spawn.y * 0x45d9f3b) ^ 0xB00C) >>> 0);
      const itemId = shopStock.generateBookShopItem(world, shopRng);
      if (itemId == null) return null;
      world.add(itemId, Position, { x: spawn.x, y: spawn.y });
      const info = world.get(itemId, ItemInfo);
      if (info) {
        world.mutate(itemId, ItemInfo, r => { r.identified = true; });
        const price = Math.ceil(appraiseItemValue(world, itemId, {
          unidentifiedGemValue: getUnidentifiedGemAppraisal(world, itemId),
        }) * 1.2);
        spawn._calculatedPrice = price;
        spawn._itemId = itemId;
      }
      return itemId;
    }
    case 'grave_tombstone':
      {
        const id = createFrom(world, GraveTombstone, { x: spawn.x, y: spawn.y });
        const data = spawn?.params?.tombstoneData || null;
        if (id > 0 && data) {
          const epitaph = generateEpitaph(data);
          world.add(id, TombstoneComponent, {
            playerName: data.playerName || 'Hero',
            depth: Number.isFinite(data.depth) ? (data.depth | 0) : 0,
            cause: data.cause || 'unknown',
            killerName: data.killerName || null,
            turn: Number.isFinite(data.turn) ? (data.turn | 0) : 0,
            epitaph,
          });
          world.set(id, Interactable, { action: 'readTombstone', params: null });
        }
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
    case 'sarcophagus':
      return createFrom(world, Sarcophagus, { x: spawn.x, y: spawn.y, depth: /** @type {any} */ (spawn.params)?.depth || 1 });
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
      } else if (def.role === "book_vendor") {
        world.add(id, Interactable, {
          action: "openBookVendor",
          params: { dialogue: def.dialogue, townfolkId: spawn.params.townfolkId },
        });
        world.add(id, ShopInventory, { buyMarkup: 1.2, sellDiscount: 0.5 });
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
          const sr = spawn.params.shopRoom;
          for (const [itemId, pos, info] of world.query(Position, ItemInfo)) {
            if (!pos || !info) continue;
            if (pos.x < sr.x || pos.x >= sr.x + sr.w || pos.y < sr.y || pos.y >= sr.y + sr.h) continue;
            const kind = String(info.type || "");
            if (kind !== "book" && kind !== "learn" && kind !== "scroll") continue;
            const price = Math.ceil(appraiseItemValue(world, itemId, {
              unidentifiedGemValue: getUnidentifiedGemAppraisal(world, itemId),
            }) * 1.2);
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
