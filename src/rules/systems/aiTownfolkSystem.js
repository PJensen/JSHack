// src/rules/systems/aiTownfolkSystem.js
// Townfolk NPC AI: scheduled overworld routines plus legacy fallback behavior.

import { Position } from "../components/Position.js";
import { Faction } from "../components/Faction.js";
import { Speed } from "../components/Speed.js";
import { MoveIntent } from "../components/Intents/MoveIntent.js";
import { AttackIntent } from "../components/Intents/AttackIntent.js";
import { playerEntity } from "../utils/queries.js";
import { DungeonState } from "../components/DungeonState.js";
import { TownfolkJob, TOWNFOLK_STATES, TOWNFOLK_ROLES } from "../components/TownfolkJob.js";
import { DoorLock } from "../components/DoorLock.js";
import { DoorState } from "../components/DoorState.js";
import { Collider } from "../components/Collider.js";
import { Interactable } from "../components/Interactable.js";
import { HarvestNode } from "../components/HarvestNode.js";
import { emitSafe } from "../utils/emitSafe.js";
import { GrowthStage } from "../components/GrowthStage.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Inventory } from "../components/Inventory.js";
import { Equipment } from "../components/Equipment.js";
import { ObjectState } from "../components/ObjectState.js";
import { RoomMetadata } from "../components/RoomMetadata.js";
import { createItemById } from "../utils/itemFactory.js";
import { forEachInRadius } from "../utils/spatialIndex.js";
import { manhattanScalar } from "../utils/distance.js";
import { findNextCardinalStep } from "../utils/gridPathfind.js";
import {
  createInventoryItem,
  consumeInventoryIdentity,
  countInventoryByIdentity,
  findFirstInventoryItemByIdentity,
  findTownContainers,
  transferFirstIdentity,
  transferUpToIdentity,
} from "../utils/townEconomy.js";
import { isWalkable, getTile, setTile } from "../environment/dungeon/tileMap.js";
import {
  getDestroyedTileLedger, getDestroyedTileRecord,
  destroyedTileKey, getDungeonStateRecord,
} from "../utils/destroyedTiles.js";
import { Unpaid } from "../components/Unpaid.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { appraiseItemValue } from "../utils/shopAppraisal.js";
import {
  TILE_TREE, TILE_GRASS, TILE_STAIR_DOWN, TILE_STAIR_UP,
  TILE_WATER, TILE_WATER_DEEP, TILE_SHALLOW_WATER, TILE_KELP_FOREST, TILE_SEAGRASS, TILE_CORAL_REEF,
} from "../environment/dungeon/constants.js";
import { getTownPhase } from "../data/calendar.js";
import { actorHasDoorKey, setDoorState } from "../utils/doorAccess.js";
import { SMITH_RECIPES, chooseSmithRecipe } from "../data/smithRecipes.js";
import { CARDINAL_DIRS } from "../utils/directions.js";
import { hasLOS } from "../../shared/math/gridLOS.js";
import { buildBlocksVisionMap, blockedCallback } from "../utils/vision.js";
import { getQuestRecord } from "../quests/runtime.js";
import { RAT_INFESTATION_QUEST_ID } from "../quests/definitions/ratInfestation.js";
import { getTownState, getWeather } from "../utils/townStateAccess.js";

const TOWNFOLK_RADIUS = 40;
const MAX_STUCK_TURNS = 5;
const WORK_RANGE = 15;
const TOWNFOLK_MONSTER_SIGHT_RANGE = 8;
const BELL_GUARD_TURNS = 120;
const TOWN_BREACH_STATE = Symbol.for("jshack:townBreach:state");

// Per-tick cached result of findTownContainers — set once at the start of
// aiTownfolkSystem and reused by all helper functions that need storage IDs.
// Avoids 11 redundant full-world NamedIdentity scans per tick.
let _cachedStorage = null;
const TOWNFOLK_DOOR_INSTALLED = Symbol.for("jshack:townfolkDoors:installed");

const CROP_KINDS = new Set(["wheat", "carrot", "corn"]);
const CROP_ITEM_IDS = Object.freeze({
  wheat: "food_wheat",
  carrot: "food_carrot",
  corn: "food_corn",
});
const SEED_ITEM_IDS = Object.freeze({
  wheat: "seed_wheat",
  carrot: "seed_carrot",
  corn: "seed_corn",
});
const HERB_ITEM_IDS = Object.freeze({
  herbs: "food_wild_herbs",
  thorn_bramble: "reagent_thorn_pod",
  venom_fern: "reagent_venom_frond",
  moonleaf: "reagent_moonleaf",
  ember_root: "reagent_ember_root",
});
const ORE_ITEM_IDS = Object.freeze({
  iron_ore: "ore_iron",
  coal_ore: "ore_coal",
  stone: "ore_stone",
});
const CARRYING_ITEM_IDS = Object.freeze({
  crops: ["food_wheat", "food_carrot", "food_corn"],
  ore: ["ore_iron", "ore_coal", "ore_stone"],
  wood: ["material_lumber", "fuel_firewood"],
  herbs: ["food_wild_herbs", "reagent_thorn_pod", "reagent_venom_frond", "reagent_moonleaf", "reagent_ember_root"],
  water: ["water_bucket"],
  fish: ["food_raw_fish"],
  flour: ["food_flour"],
  firewood: ["fuel_firewood"],
  lumber: ["material_lumber"],
});
const ROLE_TO_TOOL_ID = Object.freeze({
  woodcutter: "tool_hatchet",
  miner: "iron_pickaxe",
});

function ensureCarryInventory(world, id) {
  const inv = world.get(id, Inventory);
  if (!inv) {
    world.add(id, Inventory, { capacity: 6 });
    return;
  }
  if (Number(inv.capacity || 0) < 4) {
    world.set(id, Inventory, { ...inv, capacity: 6 });
  }
}

function itemIdentity(world, itemId) {
  return String(world.get(itemId, NamedIdentity)?.identity || "");
}

function actorHasIdentity(world, id, identity) {
  if (findFirstInventoryItemByIdentity(world, id, identity) > 0) return true;
  const eq = world.get(id, Equipment);
  if (!eq) return false;
  for (const slot of ["weapon", "offhand"]) {
    if (itemIdentity(world, Number(eq[slot] || 0)) === identity) return true;
  }
  return false;
}

function carryIdentities(job) {
  return CARRYING_ITEM_IDS[job.carrying] || (job.carrying ? [job.carrying] : []);
}

function carriedItemCount(world, id, job) {
  let total = 0;
  for (const identity of carryIdentities(job)) {
    const counts = countInventoryByIdentity(world, id);
    total += Number(counts[identity] || 0);
  }
  return total;
}

function carryCreated(world, id, itemId) {
  ensureCarryInventory(world, id);
  const createdId = createInventoryItem(world, id, itemId);
  return createdId > 0;
}

function findTownFeature(world, identity) {
  for (const [id, pos, ni] of world.query(Position, NamedIdentity)) {
    if (String(ni.identity || "") === identity) return { id, x: pos.x, y: pos.y };
  }
  return null;
}

function townBreachState(world) {
  if (!world[TOWN_BREACH_STATE]) {
    world[TOWN_BREACH_STATE] = {
      alarmActiveUntil: 0,
      bellRingerId: 0,
      sightedMonsterId: 0,
      sightedAtStep: -1,
    };
  }
  return world[TOWN_BREACH_STATE];
}

function currentDepth(world, fallback = 1) {
  for (const [, ds] of world.query(DungeonState)) return Number(ds?.currentDepth ?? fallback) | 0;
  return fallback;
}

function findTownBell(world) {
  return findTownFeature(world, "bell");
}

function rand01(world, salt = 0) {
  if (typeof world.rand === "function") return world.rand();
  const x = Math.sin(((world.step | 0) + 1) * 1103515245 + salt * 12345) * 10000;
  return x - Math.floor(x);
}

function townfolkHasServiceWeapon(world, id) {
  const eq = world.get(id, Equipment);
  if (eq?.weapon > 0) return true;
  return actorHasIdentity(world, id, "iron_pickaxe")
    || actorHasIdentity(world, id, "tool_hatchet")
    || actorHasIdentity(world, id, "tool_kitchen_knife");
}

function armTownfolkSuperficially(world, id) {
  if (!world.has(id, Equipment)) world.add(id, Equipment, {});
  const eq = world.get(id, Equipment);
  if (eq?.weapon > 0) return true;

  for (const identity of ["iron_pickaxe", "tool_hatchet", "tool_kitchen_knife"]) {
    const itemId = findFirstInventoryItemByIdentity(world, id, identity);
    if (itemId > 0) {
      eq.weapon = itemId;
      return true;
    }
  }

  ensureCarryInventory(world, id);
  const weaponId = createInventoryItem(world, id, "tool_kitchen_knife");
  if (weaponId > 0) {
    eq.weapon = weaponId;
    return true;
  }
  return false;
}

function isTownHostile(world, id) {
  const fac = world.get(id, Faction);
  if (fac?.key !== "enemy") return false;
  const pos = world.get(id, Position);
  return !!pos;
}

function nearestVisibleTownHostile(world, pos, range = TOWNFOLK_MONSTER_SIGHT_RANGE) {
  const isBlocked = blockedCallback(buildBlocksVisionMap(world));
  let best = null;
  let bestDist = Infinity;
  forEachInRadius(world, pos.x, pos.y, range, (eid, epos) => {
    if (!isTownHostile(world, eid)) return;
    const d = Math.max(Math.abs(epos.x - pos.x), Math.abs(epos.y - pos.y));
    if (d >= bestDist) return;
    if (!hasLOS(pos.x | 0, pos.y | 0, epos.x | 0, epos.y | 0, isBlocked)) return;
    best = { id: eid, x: epos.x, y: epos.y, dist: d };
    bestDist = d;
  });
  return best;
}

function assignBellRun(world, actorId, monsterId) {
  const bell = findTownBell(world);
  if (!bell) return false;
  const job = world.get(actorId, TownfolkJob);
  if (!job) return false;
  const state = townBreachState(world);
  if (state.bellRingerId > 0 && world.isAlive(state.bellRingerId)) return false;

  state.bellRingerId = actorId;
  state.sightedMonsterId = monsterId | 0;
  state.sightedAtStep = world.step | 0;

  job.state = TOWNFOLK_STATES.alarming;
  job.targetX = bell.x | 0;
  job.targetY = bell.y | 0;
  job.workSiteKind = "ring_town_bell";
  job.routineKind = "ring_town_bell";
  job.workTurns = 0;
  job.stuckTurns = 0;
  emitSafe(world, "town:breach:sighted", { witnessId: actorId, monsterId, bellId: bell.id, at: { x: bell.x | 0, y: bell.y | 0 } });
  return true;
}

function detectTownBreachSightings(world) {
  if (currentDepth(world, 1) !== 0) return;
  const state = townBreachState(world);
  if (state.alarmActiveUntil > (world.step | 0)) return;
  if (state.bellRingerId > 0 && world.isAlive(state.bellRingerId)) return;
  if (!findTownBell(world)) return;

  for (const [id, pos, fac] of world.query(Position, Faction)) {
    if (fac?.key !== "townfolk") continue;
    const job = world.get(id, TownfolkJob);
    if (!job || job.state === TOWNFOLK_STATES.sleeping) continue;
    const hostile = nearestVisibleTownHostile(world, pos);
    if (!hostile) continue;
    assignBellRun(world, id, hostile.id);
    return;
  }
}

function handleBellRun(world, id, pos, job) {
  const bell = findTownBell(world);
  if (!bell) {
    setIdle(job, world);
    return;
  }
  job.targetX = bell.x | 0;
  job.targetY = bell.y | 0;
  if (nearPoint(pos, bell.x, bell.y, 1)) {
    emitSafe(world, "bell:rung", { actor: id, targetId: bell.id, reason: "monster_sighted" });
    return;
  }
  const moved = stepToward(world, id, pos, bell.x, bell.y);
  if (!moved) {
    job.stuckTurns++;
    if (job.stuckTurns >= MAX_STUCK_TURNS) {
      townBreachState(world).bellRingerId = 0;
      setIdle(job, world);
    }
    return;
  }
  job.stuckTurns = 0;
}

function handleHiding(world, id, pos, job) {
  const tx = Number.isFinite(job.targetX) ? job.targetX : job.homeX;
  const ty = Number.isFinite(job.targetY) ? job.targetY : job.homeY;
  if (nearPoint(pos, tx, ty, 1)) {
    closeOwnedShopDoors(world, id);
    job.guardTurnsLeft--;
    if (job.guardTurnsLeft <= 0) setIdle(job, world);
    return;
  }
  if (!stepToward(world, id, pos, tx, ty)) {
    job.guardTurnsLeft--;
    if (job.guardTurnsLeft <= 0) setIdle(job, world);
  }
}

function handleArmedTownfolk(world, id, pos, job) {
  job.guardTurnsLeft--;
  if (job.guardTurnsLeft <= 0) {
    job.state = TOWNFOLK_STATES.idle;
    job.guardTurnsLeft = 0;
    job.workTurns = 0;
    job.stuckTurns = 0;
    return;
  }
  const hostile = nearestVisibleTownHostile(world, pos, 10);
  if (!hostile) return;
  if (hostile.dist <= 1) {
    try { world.add(id, AttackIntent, { targetId: hostile.id }); } catch {}
    return;
  }
  stepToward(world, id, pos, hostile.x, hostile.y);
}

function applyTownAlarmResponse(world, bellActorId = 0, sightedMonsterId = 0) {
  const state = townBreachState(world);
  state.alarmActiveUntil = Math.max(state.alarmActiveUntil | 0, (world.step | 0) + BELL_GUARD_TURNS);
  state.bellRingerId = 0;

  for (const [id, job] of world.query(TownfolkJob)) {
    if (!world.isAlive(id)) continue;
    if (id === bellActorId) {
      job.state = TOWNFOLK_STATES.armed;
      job.guardTurnsLeft = BELL_GUARD_TURNS;
      job.workTurns = 0;
      job.stuckTurns = 0;
      armTownfolkSuperficially(world, id);
      continue;
    }

    const pos = world.get(id, Position);
    const hasTool = townfolkHasServiceWeapon(world, id);
    const defenderRole = job.role === TOWNFOLK_ROLES.miner
      || job.role === TOWNFOLK_ROLES.woodcutter
      || job.role === TOWNFOLK_ROLES.mason
      || job.role === TOWNFOLK_ROLES.smith;
    const roll = rand01(world, id);
    const rally = hasTool || defenderRole || roll < 0.35;
    if (rally) {
      armTownfolkSuperficially(world, id);
      job.state = TOWNFOLK_STATES.armed;
      job.guardTurnsLeft = BELL_GUARD_TURNS + Math.floor(rand01(world, id + 17) * 40);
      if (pos) {
        const hostilePos = world.get(sightedMonsterId, Position);
        job.targetX = hostilePos?.x ?? pos.x;
        job.targetY = hostilePos?.y ?? pos.y;
      }
    } else {
      job.state = TOWNFOLK_STATES.hiding;
      job.guardTurnsLeft = 60 + Math.floor(rand01(world, id + 31) * 80);
      job.targetX = job.homeX;
      job.targetY = job.homeY;
    }
    job.workTurns = 0;
    job.stuckTurns = 0;
  }
}

function processTownEmergencyActors(world) {
  const processed = new Set();
  for (const [id, pos, fac] of world.query(Position, Faction)) {
    if (fac?.key !== "townfolk") continue;
    const job = world.get(id, TownfolkJob);
    if (!job) continue;
    if (
      job.state !== TOWNFOLK_STATES.alarming
      && job.state !== TOWNFOLK_STATES.armed
      && job.state !== TOWNFOLK_STATES.hiding
    ) continue;
    if (world.has(id, MoveIntent)) {
      processed.add(id);
      continue;
    }
    if (job.state === TOWNFOLK_STATES.alarming) handleBellRun(world, id, pos, job);
    else if (job.state === TOWNFOLK_STATES.armed) handleArmedTownfolk(world, id, pos, job);
    else handleHiding(world, id, pos, job);
    processed.add(id);
  }
  return processed;
}

function isFishableTile(tile) {
  return tile === TILE_WATER
    || tile === TILE_WATER_DEEP
    || tile === TILE_SHALLOW_WATER
    || tile === TILE_KELP_FOREST
    || tile === TILE_SEAGRASS
    || tile === TILE_CORAL_REEF;
}

function findFishableShoreSpot(cx, cy, radius = 12) {
  let best = null;
  let bestDist = Infinity;
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      const d = manhattanScalar(x, y, cx, cy);
      if (d > radius || d >= bestDist) continue;
      if (!isWalkable(x, y)) continue;
      let touchesWater = false;
      for (const dir of CARDINAL_DIRS) {
        if (isFishableTile(getTile(x + dir.dx, y + dir.dy))) {
          touchesWater = true;
          break;
        }
      }
      if (!touchesWater) continue;
      best = { x, y };
      bestDist = d;
    }
  }
  return best;
}

function activateWorkstation(world, identity, fallbackState, duration = 4) {
  const feature = findTownFeature(world, identity);
  if (!(feature?.id > 0)) return;
  const inter = world.get(feature.id, Interactable);
  const params = (inter?.params && typeof inter.params === "object") ? { ...inter.params } : {};
  const activeState = String(params.activeState || fallbackState || "working");
  params.activeUntilStep = (Number(world.step || 0) | 0) + Math.max(1, Number(duration || 0) | 0);
  if (world.has(feature.id, ObjectState)) {
    world.set(feature.id, ObjectState, { state: activeState });
  }
  if (inter) {
    world.set(feature.id, Interactable, {
      action: inter.action,
      params,
    });
  }
}

function getEntityPosition(world, id) {
  if (!(id > 0)) return null;
  const pos = world.get(id, Position);
  return pos ? { x: pos.x, y: pos.y } : null;
}

function depositCarriedItems(world, actorId, chestId, job) {
  if (!(chestId > 0)) return 0;
  let moved = 0;
  for (const identity of carryIdentities(job)) {
    moved += transferUpToIdentity(world, actorId, chestId, identity, 99);
  }
  return moved;
}

function moveChestItemToActor(world, fromChestId, actorId, identity) {
  ensureCarryInventory(world, actorId);
  return transferFirstIdentity(world, fromChestId, actorId, identity) > 0;
}

function setCarry(job, resource, count = 1) {
  job.carrying = resource;
  job.carryCount = Math.max(1, Number(count) | 0);
}

function totalTownToolCount(world, storage, identity) {
  let total = 0;
  for (const ownerId of [storage.smithy, storage.tavern]) {
    if (ownerId > 0) total += countInventoryByIdentity(world, ownerId)[identity] || 0;
  }
  for (const [id, fac] of world.query(Faction)) {
    if (String(fac.key || "") !== "townfolk") continue;
    if (actorHasIdentity(world, id, identity)) total++;
  }
  return total;
}

function chooseSmithCraft(world, storage) {
  const smith = storage.smithy > 0 ? countInventoryByIdentity(world, storage.smithy) : {};
  const hasIron = Number(smith.material_iron || 0);
  const hasLumber = Number(smith.material_lumber || 0);
  const craftable = SMITH_RECIPES.filter((recipe) => hasIron >= recipe.iron && hasLumber >= recipe.lumber);
  return chooseSmithRecipe(craftable, (itemId) => totalTownToolCount(world, storage, itemId));
}

function deliverNear(pos) {
  if (!pos) return null;
  return findAdjacentWalkable(pos.x, pos.y) || pos;
}

function chooseVillagerHaul(world) {
  const storage = _cachedStorage;
  const mill = storage.mill > 0 ? countInventoryByIdentity(world, storage.mill) : {};
  const lumber = storage.lumber > 0 ? countInventoryByIdentity(world, storage.lumber) : {};
  const smith = storage.smithy > 0 ? countInventoryByIdentity(world, storage.smithy) : {};
  const tavern = storage.tavern > 0 ? countInventoryByIdentity(world, storage.tavern) : {};
  const well = findTownFeature(world, "fountain");
  const tavernPos = getEntityPosition(world, storage.tavern);
  const millPos = getEntityPosition(world, storage.mill);
  const lumberPos = getEntityPosition(world, storage.lumber);
  const smithPos = getEntityPosition(world, storage.smithy);
  const tavernDrop = deliverNear(tavernPos);
  const smithDrop = deliverNear(smithPos);

  if (storage.tavern > 0 && well && tavernDrop && Number(tavern.water_bucket || 0) < 2) {
    return {
      x: well.x,
      y: well.y,
      kind: "fetch_water",
      state: TOWNFOLK_STATES.working,
      radius: 1,
      deliverX: tavernDrop.x,
      deliverY: tavernDrop.y,
    };
  }
  if (storage.mill > 0 && storage.tavern > 0 && millPos && tavernDrop && Number(mill.food_flour || 0) > 0 && Number(tavern.food_flour || 0) < 2) {
    return {
      x: millPos.x,
      y: millPos.y,
      kind: "haul_flour",
      state: TOWNFOLK_STATES.working,
      radius: 1,
      deliverX: tavernDrop.x,
      deliverY: tavernDrop.y,
    };
  }
  if (storage.lumber > 0 && storage.tavern > 0 && lumberPos && tavernDrop && Number(lumber.fuel_firewood || 0) > 0 && Number(tavern.fuel_firewood || 0) < 2) {
    return {
      x: lumberPos.x,
      y: lumberPos.y,
      kind: "haul_firewood",
      state: TOWNFOLK_STATES.working,
      radius: 1,
      deliverX: tavernDrop.x,
      deliverY: tavernDrop.y,
    };
  }
  if (storage.lumber > 0 && storage.smithy > 0 && lumberPos && smithDrop && Number(lumber.material_lumber || 0) > 0 && Number(smith.material_lumber || 0) < 2) {
    return {
      x: lumberPos.x,
      y: lumberPos.y,
      kind: "haul_lumber",
      state: TOWNFOLK_STATES.working,
      radius: 1,
      deliverX: smithDrop.x,
      deliverY: smithDrop.y,
    };
  }
  return null;
}

/** Find nearest ready HarvestNode of given kinds within radius of (cx,cy). */
function findReadyNode(world, cx, cy, radius, kindFilter) {
  let best = null;
  let bestDist = Infinity;
  forEachInRadius(world, cx, cy, radius, (eid, epos) => {
    const node = world.get(eid, HarvestNode);
    if (!node || !node.ready) return;
    if (kindFilter && !kindFilter(node)) return;
    const d = manhattanScalar(epos.x, epos.y, cx, cy);
    if (d < bestDist) { bestDist = d; best = { id: eid, x: epos.x, y: epos.y }; }
  });
  return best;
}

/** Find nearest crop that needs planting within radius. */
function findNeedsPlantingNode(world, cx, cy, radius) {
  let best = null;
  let bestDist = Infinity;
  forEachInRadius(world, cx, cy, radius, (eid, epos) => {
    const node = world.get(eid, HarvestNode);
    if (!node || !node.needsPlanting) return;
    if (!CROP_KINDS.has(node.kind)) return;
    const d = manhattanScalar(epos.x, epos.y, cx, cy);
    if (d < bestDist) { bestDist = d; best = { id: eid, x: epos.x, y: epos.y }; }
  });
  return best;
}

/** Harvest a HarvestNode: deplete it and reset its GrowthStage visuals. */
function depleteNode(world, nodeId) {
  const node = world.get(nodeId, HarvestNode);
  if (!node) return;
  node.ready = false;
  if (node.replantable) {
    node.needsPlanting = true;
    node.regrowCountdown = 0;
  } else {
    node.regrowCountdown = node.regrowTurns;
  }
  const gs = world.get(nodeId, GrowthStage);
  if (gs && gs.stageIdentities?.length) {
    gs.currentStage = 0;
    const ni = world.get(nodeId, NamedIdentity);
    if (ni) { ni.name = gs.stageIdentities[0]; ni.identity = gs.stageIdentities[0]; }
  }
}

// getTownPhase is now imported from ../data/calendar.js
export { getTownPhase } from "../data/calendar.js";

function isStormShelterRole(role) {
  return role === TOWNFOLK_ROLES.farmer
    || role === TOWNFOLK_ROLES.woodcutter
    || role === TOWNFOLK_ROLES.herbalist
    || role === TOWNFOLK_ROLES.fisher
    || role === TOWNFOLK_ROLES.villager
    || role === TOWNFOLK_ROLES.miner;
}

function atTarget(pos, x, y) {
  return pos.x === x && pos.y === y;
}

function nearPoint(pos, x, y, dist = 1) {
  return Math.abs(pos.x - x) <= dist && Math.abs(pos.y - y) <= dist;
}

function effectiveScheduleRadius(world, x, y, radius = 0) {
  const base = Math.max(0, Number(radius || 0) | 0);
  if (base > 0) return base;
  for (const [, pos, inter, col] of world.query(Position, Interactable, Collider)) {
    if (pos.x !== x || pos.y !== y) continue;
    if (col?.solid) return 1;
  }
  return base;
}

function findDoorAt(world, x, y) {
  for (const [id, pos, state] of world.query(Position, DoorState)) {
    if (pos.x === x && pos.y === y) return { id, state };
  }
  return null;
}

function doorOccupied(world, x, y) {
  for (const [id, pos] of world.query(Position)) {
    if (pos.x !== x || pos.y !== y) continue;
    if (world.has(id, DoorState)) continue;
    return true;
  }
  return false;
}

function isInRoom(x, y, room) {
  return x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h;
}

function findOwnedShopRoom(world, actorId, x, y) {
  for (const [, room] of world.query(RoomMetadata)) {
    if (room.roomType !== "shop") continue;
    if (Number(room.shopkeeperId || 0) !== (actorId | 0)) continue;
    if (isInRoom(x, y, room)) return room;
  }
  return null;
}

function findOwnedShopRoomByActor(world, actorId) {
  for (const [, room] of world.query(RoomMetadata)) {
    if (room.roomType !== "shop") continue;
    if (Number(room.shopkeeperId || 0) !== (actorId | 0)) continue;
    return room;
  }
  return null;
}

/** Open (and unlock) any shop door the vendor owns a key for. */
function openOwnedShopDoors(world, actorId) {
  for (const [doorId, , doorState] of world.query(Position, DoorState)) {
    if (doorState.open) continue;
    if (!actorHasDoorKey(world, actorId, doorId)) continue;
    setDoorState(world, doorId, { open: true, locked: false }, actorId);
  }
}

function closeOwnedShopDoors(world, actorId) {
  for (const [doorId, pos, doorState] of world.query(Position, DoorState)) {
    if (!actorHasDoorKey(world, actorId, doorId)) continue;
    if (doorOccupied(world, pos.x, pos.y)) continue;
    const canLock = !!world.get(doorId, DoorLock)?.lockId;
    if (!doorState.open && doorState.locked === canLock) continue;
    setDoorState(world, doorId, { open: false, locked: canLock }, actorId);
  }
}

function shopHasCustomer(world, actorId) {
  const room = findOwnedShopRoomByActor(world, actorId);
  if (!room) return false;
  const _player = playerEntity(world);
  return _player != null && isInRoom(_player.pos.x, _player.pos.y, room);
}

export function installTownfolkDoorListener(world) {
  if (!world || world[TOWNFOLK_DOOR_INSTALLED]) return;
  world[TOWNFOLK_DOOR_INSTALLED] = true;

  world.on("moved", ({ id, from, to }) => {
    const fac = world.get(id, Faction);
    if (fac?.key !== "townfolk") return;
    const door = findDoorAt(world, from?.x, from?.y);
    if (!door || !door.state?.open) return;
    if (doorOccupied(world, from.x, from.y)) return;
    const room = findOwnedShopRoom(world, id, from.x, from.y);
    const canLock = !!world.get(door.id, DoorLock)?.lockId && actorHasDoorKey(world, id, door.id);
    const goingOut = room && to ? !isInRoom(to.x, to.y, room) : false;
    setDoorState(world, door.id, {
      open: false,
      locked: !!(canLock && goingOut),
    }, id);
  });
}

function maybeOpenDoor(world, actorId, x, y) {
  const door = findDoorAt(world, x, y);
  if (!door || door.state?.open) return false;
  if (door.state?.locked && !actorHasDoorKey(world, actorId, door.id)) return false;
  setDoorState(world, door.id, { open: true, locked: false }, actorId);
  return true;
}

function findAdjacentWalkable(x, y) {
  for (const d of CARDINAL_DIRS) {
    const nx = x + d.dx;
    const ny = y + d.dy;
    if (!isWalkable(nx, ny)) continue;
    const t = getTile(nx, ny);
    if (t !== TILE_STAIR_DOWN && t !== TILE_STAIR_UP) return { x: nx, y: ny };
  }
  return null;
}

function stepToward(world, id, pos, tx, ty) {
  const next = findNextCardinalStep(world, pos.x, pos.y, tx, ty, id, {
    goalRadius: 0,
    maxNodes: 256,
    passThroughDoors: true,
  });
  const dx = next?.dx ?? 0;
  const dy = next?.dy ?? 0;
  if (dx === 0 && dy === 0) return false;

  const nx = pos.x + dx;
  const ny = pos.y + dy;
  if (!isWalkable(nx, ny)) return false;
  const t = getTile(nx, ny);
  if (t === TILE_STAIR_DOWN || t === TILE_STAIR_UP) return false;
  if (maybeOpenDoor(world, id, nx, ny)) return true;
  try { world.add(id, MoveIntent, { dx, dy }); } catch { return false; }
  return true;
}

function setIdle(job, world) {
  job.state = TOWNFOLK_STATES.idle;
  job.idleTurns = 3 + Math.floor(world.rand() * 6);
  job.stuckTurns = 0;
  job.workSiteKind = "";
}

function setReturning(job) {
  if (job.carrying && (job.deliverX || job.deliverY)) {
    job.state = TOWNFOLK_STATES.delivering;
    job.targetX = job.deliverX;
    job.targetY = job.deliverY;
  } else {
    job.state = TOWNFOLK_STATES.returning;
    job.targetX = job.homeX;
    job.targetY = job.homeY;
  }
  job.stuckTurns = 0;
}

function handleIdle(world, id, pos, job) {
  if (job.idleTurns > 0) {
    job.idleTurns--;
    return;
  }

  switch (job.role) {
    case TOWNFOLK_ROLES.farmer: {
      const crop = findReadyNode(world, job.workX, job.workY, 15,
        (n) => CROP_KINDS.has(n.kind));
      if (crop) {
        job.targetX = crop.x;
        job.targetY = crop.y;
        job.workSiteKind = "harvest_crop";
      } else {
        // No ready crops — plant any that need it
        const plant = findNeedsPlantingNode(world, job.workX, job.workY, 15);
        if (plant) {
          job.targetX = plant.x;
          job.targetY = plant.y;
          job.workSiteKind = "plant_crop";
        } else {
          // Nothing to plant either — tend the field cosmetically
          const ox = Math.floor(world.rand() * 5) - 2;
          const oy = 1 + Math.floor(world.rand() * 5);
          job.targetX = job.homeX + ox;
          job.targetY = job.homeY + oy;
          job.workSiteKind = "tend";
        }
      }
      break;
    }
    case TOWNFOLK_ROLES.woodcutter: {
      const tree = findReadyNode(world, job.workX, job.workY, WORK_RANGE,
        (n) => n.kind === "tree");
      if (!tree) {
        job.idleTurns = 8;
        return;
      }
      const adj = findAdjacentWalkable(tree.x, tree.y);
      job.targetX = adj ? adj.x : tree.x;
      job.targetY = adj ? adj.y : tree.y;
      job.workSiteKind = "chop";
      break;
    }
    case TOWNFOLK_ROLES.miner: {
      const ore = findReadyNode(world, job.workX, job.workY, 8,
        (n) => n.requiresTool === "dig");
      if (ore) {
        const adj = findAdjacentWalkable(ore.x, ore.y);
        job.targetX = adj ? adj.x : ore.x;
        job.targetY = adj ? adj.y : ore.y;
      } else {
        // No ready nodes — walk toward quarry anyway
        const ox = 10 + Math.floor(world.rand() * 10);
        const oy = -(5 + Math.floor(world.rand() * 10));
        job.targetX = job.homeX + ox;
        job.targetY = job.homeY + oy;
      }
      job.workSiteKind = "mine";
      break;
    }
    case TOWNFOLK_ROLES.smith: {
      const ox = Math.floor(world.rand() * 5) - 2;
      const oy = Math.floor(world.rand() * 5) - 2;
      job.targetX = job.homeX + ox;
      job.targetY = job.homeY + oy;
      job.workSiteKind = "smith";
      break;
    }
    case TOWNFOLK_ROLES.priest: {
      const ox = Math.floor(world.rand() * 3) - 1;
      const oy = Math.floor(world.rand() * 3) - 1;
      job.targetX = job.homeX + ox;
      job.targetY = job.homeY + oy;
      job.workSiteKind = "pray";
      break;
    }
    case TOWNFOLK_ROLES.barkeep: {
      const ox = Math.floor(world.rand() * 5) - 2;
      const oy = Math.floor(world.rand() * 3) - 1;
      job.targetX = job.homeX + ox;
      job.targetY = job.homeY + oy;
      job.workSiteKind = "serve";
      break;
    }
    case TOWNFOLK_ROLES.mason: {
      const ledger = getDestroyedTileLedger(world);
      const entries = Object.values(ledger);
      if (entries.length === 0) {
        job.idleTurns = 8;
        return;
      }
      let best = null;
      let bestDist = Infinity;
      for (const rec of entries) {
        const d = manhattanScalar(rec.x, rec.y, pos.x, pos.y);
        if (d < bestDist) {
          bestDist = d;
          best = rec;
        }
      }
      if (!best || bestDist > 40) {
        job.idleTurns = 8;
        return;
      }
      job.targetX = best.x;
      job.targetY = best.y;
      job.workSiteKind = "repair";
      break;
    }
    case TOWNFOLK_ROLES.herbalist: {
      const herb = findReadyNode(world, job.workX, job.workY, WORK_RANGE,
        (n) => n.kind === "herbs" || n.kind === "thorn_bramble" || n.kind === "venom_fern" || n.kind === "moonleaf" || n.kind === "ember_root");
      if (herb) {
        job.targetX = herb.x;
        job.targetY = herb.y;
        job.workSiteKind = "harvest_herb";
      } else {
        job.targetX = job.workX;
        job.targetY = job.workY;
        job.workSiteKind = "sort_herbs";
      }
      break;
    }
    case TOWNFOLK_ROLES.alchemist: {
      job.targetX = job.workX;
      job.targetY = job.workY;
      job.workSiteKind = "brew";
      break;
    }
    case TOWNFOLK_ROLES.enchantress: {
      job.targetX = job.workX;
      job.targetY = job.workY;
      job.workSiteKind = "tend_stall";
      break;
    }
    case TOWNFOLK_ROLES.fisher: {
      const spot = findFishableShoreSpot(job.workX, job.workY, WORK_RANGE);
      if (!spot) {
        job.idleTurns = 8;
        return;
      }
      job.targetX = spot.x;
      job.targetY = spot.y;
      job.workSiteKind = "fish";
      break;
    }
    case TOWNFOLK_ROLES.gem_vendor:
    case TOWNFOLK_ROLES.book_vendor:
    case TOWNFOLK_ROLES.general_vendor: {
      job.targetX = job.workX;
      job.targetY = job.workY;
      job.workSiteKind = "tend_stall";
      break;
    }
    default: {
      const ox = Math.floor(world.rand() * 17) - 8;
      const oy = Math.floor(world.rand() * 17) - 8;
      job.targetX = job.homeX + ox;
      job.targetY = job.homeY + oy;
      job.workSiteKind = "wander";
      break;
    }
  }

  job.state = TOWNFOLK_STATES.walking;
  job.stuckTurns = 0;
}

function handleWalking(world, id, pos, job) {
  if (atTarget(pos, job.targetX, job.targetY) || nearPoint(pos, job.targetX, job.targetY, 1)) {
    job.state = TOWNFOLK_STATES.working;
    job.workTurns = 2 + Math.floor(world.rand() * 3);
    job.stuckTurns = 0;
    return;
  }

  const moved = stepToward(world, id, pos, job.targetX, job.targetY);
  if (!moved) {
    job.stuckTurns++;
    if (job.stuckTurns >= MAX_STUCK_TURNS) setIdle(job, world);
    return;
  }
  job.stuckTurns = 0;
}

function handleWorking(world, id, pos, job) {
  if (job.workTurns > 0) {
    job.workTurns--;
    return;
  }

  ensureCarryInventory(world, id);

  switch (job.workSiteKind) {
    case "chop": {
      if (!actorHasIdentity(world, id, ROLE_TO_TOOL_ID.woodcutter)) {
        emitSafe(world, "townfolk:needs_tool", { actor: id, tool: ROLE_TO_TOOL_ID.woodcutter });
        setIdle(job, world);
        return;
      }
      let treeId = 0;
      forEachInRadius(world, pos.x, pos.y, 1, (eid) => {
        if (treeId) return;
        const n = world.get(eid, HarvestNode);
        if (n && n.ready && n.kind === "tree") treeId = eid;
      });
      if (treeId) {
        depleteNode(world, treeId);
        const col = world.get(treeId, Collider);
        if (col) world.set(treeId, Collider, { solid: false, blocksSight: false });
        emitSafe(world, "townfolk:chopped", { actor: id, x: pos.x, y: pos.y });
        carryCreated(world, id, "material_lumber");
        carryCreated(world, id, "fuel_firewood");
        setCarry(job, "wood", 2);
        emitSafe(world, "townfolk:carrying", { actor: id, resource: "wood" });
        setReturning(job);
        return;
      }
      setReturning(job);
      return;
    }
    case "harvest_crop": {
      // Find the crop entity at or adjacent to current position
      let cropId = 0;
      forEachInRadius(world, pos.x, pos.y, 1, (eid) => {
        if (cropId) return;
        const n = world.get(eid, HarvestNode);
        if (n && n.ready && CROP_KINDS.has(n.kind)) cropId = eid;
      });
      if (cropId) {
        const cropNode = world.get(cropId, HarvestNode);
        depleteNode(world, cropId);
        const itemId = CROP_ITEM_IDS[String(cropNode?.kind || "")] || "food_wheat";
        carryCreated(world, id, itemId);
        // Always get a seed from the harvest.
        const seedId = SEED_ITEM_IDS[String(cropNode?.kind || "")];
        if (seedId) carryCreated(world, id, seedId);
        // Auto-replant: farmer plants immediately after harvesting (already adjacent).
        const hn = world.get(cropId, HarvestNode);
        if (hn && hn.needsPlanting) {
          hn.needsPlanting = false;
          hn.regrowCountdown = hn.regrowTurns;
          if (seedId) consumeInventoryIdentity(world, id, seedId, 1);
          emitSafe(world, "townfolk:planted", { actor: id, x: pos.x, y: pos.y });
        }
        job.carryCount++;
        emitSafe(world, "townfolk:harvested", { actor: id, x: pos.x, y: pos.y });
        // Look for more if not full
        if (job.carryMax > 0 && job.carryCount < job.carryMax) {
          const next = findReadyNode(world, job.workX, job.workY, 15,
            (n) => CROP_KINDS.has(n.kind));
          if (next) {
            job.targetX = next.x;
            job.targetY = next.y;
            job.state = TOWNFOLK_STATES.walking;
            job.stuckTurns = 0;
            return;
          }
        }
      }
      setCarry(job, "crops", Math.max(1, job.carryCount));
      emitSafe(world, "townfolk:carrying", { actor: id, resource: "crops" });
      setReturning(job);
      return;
    }
    case "plant_crop": {
      let planted = false;
      forEachInRadius(world, pos.x, pos.y, 1, (eid) => {
        if (planted) return;
        const n = world.get(eid, HarvestNode);
        if (n && n.needsPlanting && CROP_KINDS.has(n.kind)) {
          n.needsPlanting = false;
          n.regrowCountdown = n.regrowTurns;
          planted = true;
          emitSafe(world, "townfolk:planted", { actor: id, x: pos.x, y: pos.y });
        }
      });
      // Look for more to plant
      const next = findNeedsPlantingNode(world, job.workX, job.workY, 15);
      if (next) {
        job.targetX = next.x;
        job.targetY = next.y;
        job.state = TOWNFOLK_STATES.walking;
        job.stuckTurns = 0;
        return;
      }
      setReturning(job);
      return;
    }
    case "mine": {
      if (!actorHasIdentity(world, id, ROLE_TO_TOOL_ID.miner)) {
        emitSafe(world, "townfolk:needs_tool", { actor: id, tool: ROLE_TO_TOOL_ID.miner });
        setIdle(job, world);
        return;
      }
      // Find adjacent ore node and actually deplete it
      let oreId = 0;
      let oreItemId = "ore_iron";
      forEachInRadius(world, pos.x, pos.y, 1, (eid) => {
        if (oreId) return;
        const n = world.get(eid, HarvestNode);
        if (n && n.ready && n.requiresTool === "dig") {
          oreId = eid;
          oreItemId = ORE_ITEM_IDS[String(n.kind || "")] || String(n.yield || "ore_iron");
        }
      });
      if (oreId) depleteNode(world, oreId);
      carryCreated(world, id, oreItemId);
      emitSafe(world, "townfolk:mined", { actor: id, x: pos.x, y: pos.y });
      setCarry(job, "ore");
      emitSafe(world, "townfolk:carrying", { actor: id, resource: "ore" });
      setReturning(job);
      return;
    }
    case "repair": {
      const storage = _cachedStorage;
      const lumberSpent =
        consumeInventoryIdentity(world, storage.lumber, "material_lumber", 1)
        || consumeInventoryIdentity(world, storage.smithy, "material_lumber", 1);
      if (!lumberSpent) {
        emitSafe(world, "townfolk:needs_lumber", { actor: id, x: job.targetX, y: job.targetY });
        setIdle(job, world);
        return;
      }
      const rec = getDestroyedTileRecord(world, job.targetX, job.targetY);
      if (rec && rec.originalTile != null) {
        setTile(job.targetX, job.targetY, rec.originalTile);
        const ds = getDungeonStateRecord(world);
        if (ds && ds.destroyedTiles) {
          delete ds.destroyedTiles[destroyedTileKey(job.targetX, job.targetY)];
        }
        emitSafe(world, "townfolk:repaired", { actor: id, x: job.targetX, y: job.targetY });
      }
      setReturning(job);
      return;
    }
    case "harvest_herb": {
      let herbId = 0;
      let herbKind = "herbs";
      forEachInRadius(world, pos.x, pos.y, 1, (eid) => {
        if (herbId) return;
        const n = world.get(eid, HarvestNode);
        if (n && n.ready && (n.kind === "herbs" || n.kind === "thorn_bramble" || n.kind === "venom_fern" || n.kind === "moonleaf" || n.kind === "ember_root")) {
          herbId = eid;
          herbKind = n.kind;
        }
      });
      if (herbId) depleteNode(world, herbId);
      carryCreated(world, id, HERB_ITEM_IDS[herbKind] || "food_wild_herbs");
      job.carryCount++;
      emitSafe(world, "townfolk:gathered_herbs", { actor: id, x: pos.x, y: pos.y });
      if (job.carryMax > 0 && job.carryCount < job.carryMax) {
        const next = findReadyNode(world, job.workX, job.workY, WORK_RANGE,
          (n) => n.kind === "herbs" || n.kind === "thorn_bramble" || n.kind === "venom_fern" || n.kind === "moonleaf" || n.kind === "ember_root");
        if (next) {
          job.targetX = next.x;
          job.targetY = next.y;
          job.state = TOWNFOLK_STATES.walking;
          job.stuckTurns = 0;
          return;
        }
      }
      setCarry(job, "herbs", Math.max(1, job.carryCount));
      emitSafe(world, "townfolk:carrying", { actor: id, resource: "herbs" });
      setReturning(job);
      return;
    }
    case "mill": {
      const storage = _cachedStorage;
      if (storage.mill > 0) depositCarriedItems(world, id, storage.mill, job);
      const stock = storage.mill > 0 ? countInventoryByIdentity(world, storage.mill) : {};
      if ((stock.food_wheat || 0) > 0 && storage.mill > 0) {
        consumeInventoryIdentity(world, storage.mill, "food_wheat", 1);
        createInventoryItem(world, storage.mill, "food_flour");
        activateWorkstation(world, "millstone", "working");
        emitSafe(world, "townfolk:milled", { actor: id, x: pos.x, y: pos.y });
      }
      job.carrying = "";
      job.carryCount = 0;
      setReturning(job);
      return;
    }
    case "forge_tools": {
      const storage = _cachedStorage;
      const smithyCounts = storage.smithy > 0 ? countInventoryByIdentity(world, storage.smithy) : {};
      if (storage.smithy > 0 && (smithyCounts.ore_iron || 0) > 0 && (smithyCounts.ore_coal || 0) > 0) {
        consumeInventoryIdentity(world, storage.smithy, "ore_iron", 1);
        consumeInventoryIdentity(world, storage.smithy, "ore_coal", 1);
        createInventoryItem(world, storage.smithy, "material_iron");
        activateWorkstation(world, "furnace", "lit", 5);
        emitSafe(world, "townfolk:smelted", { actor: id, x: pos.x, y: pos.y, itemId: "material_iron" });
      }
      const craft = chooseSmithCraft(world, storage);
      if (!craft || !(storage.smithy > 0)) {
        emitSafe(world, "townfolk:inspected", { actor: id, x: pos.x, y: pos.y });
        setReturning(job);
        return;
      }
      consumeInventoryIdentity(world, storage.smithy, "material_iron", craft.iron);
      consumeInventoryIdentity(world, storage.smithy, "material_lumber", craft.lumber);
      createInventoryItem(world, storage.smithy, craft.itemId);
      activateWorkstation(world, "anvil", "working");
      emitSafe(world, "townfolk:forged", { actor: id, x: pos.x, y: pos.y, itemId: craft.itemId });
      setReturning(job);
      return;
    }
    case "cook": {
      const storage = _cachedStorage;
      const tavern = storage.tavern;
      const stock = tavern > 0 ? countInventoryByIdentity(world, tavern) : {};
      if (!(tavern > 0) || (stock.food_flour || 0) <= 0 || (stock.water_bucket || 0) <= 0 || (stock.fuel_firewood || 0) <= 0 || (stock.tool_kitchen_knife || 0) <= 0) {
        emitSafe(world, "townfolk:poured", { actor: id, x: pos.x, y: pos.y });
        setReturning(job);
        return;
      }
      consumeInventoryIdentity(world, tavern, "food_flour", 1);
      consumeInventoryIdentity(world, tavern, "fuel_firewood", 1);
      createInventoryItem(world, tavern, "food_stew");
      activateWorkstation(world, "cooking_fire", "lit", 4);
      emitSafe(world, "townfolk:cooked", { actor: id, x: pos.x, y: pos.y, itemId: "food_stew" });
      setReturning(job);
      return;
    }
    case "fetch_water": {
      carryCreated(world, id, "water_bucket");
      setCarry(job, "water");
      emitSafe(world, "townfolk:carrying", { actor: id, resource: "water" });
      setReturning(job);
      return;
    }
    case "fish": {
      carryCreated(world, id, "food_raw_fish");
      setCarry(job, "fish");
      emitSafe(world, "townfolk:fished", { actor: id, x: pos.x, y: pos.y, itemId: "food_raw_fish" });
      emitSafe(world, "townfolk:carrying", { actor: id, resource: "fish" });
      setReturning(job);
      return;
    }
    case "haul_flour": {
      const storage = _cachedStorage;
      if (moveChestItemToActor(world, storage.mill, id, "food_flour")) {
        setCarry(job, "flour");
        emitSafe(world, "townfolk:carrying", { actor: id, resource: "flour" });
        setReturning(job);
        return;
      }
      setIdle(job, world);
      return;
    }
    case "haul_firewood": {
      const storage = _cachedStorage;
      if (moveChestItemToActor(world, storage.lumber, id, "fuel_firewood")) {
        setCarry(job, "firewood");
        emitSafe(world, "townfolk:carrying", { actor: id, resource: "firewood" });
        setReturning(job);
        return;
      }
      setIdle(job, world);
      return;
    }
    case "haul_lumber": {
      const storage = _cachedStorage;
      if (moveChestItemToActor(world, storage.lumber, id, "material_lumber")) {
        setCarry(job, "lumber");
        emitSafe(world, "townfolk:carrying", { actor: id, resource: "lumber" });
        setReturning(job);
        return;
      }
      setIdle(job, world);
      return;
    }
    case "brew": {
      const storage = _cachedStorage;
      const herbChest = storage.herb;
      const stock = herbChest > 0 ? countInventoryByIdentity(world, herbChest) : {};
      const herbCount = Number(stock.food_wild_herbs || 0);
      const thornCount = Number(stock.reagent_thorn_pod || 0);
      const venomCount = Number(stock.reagent_venom_frond || 0);
      const moonleafCount = Number(stock.reagent_moonleaf || 0);
      const emberRootCount = Number(stock.reagent_ember_root || 0);
      if (countShopStock(world, id) >= BREW_STOCK_LIMIT) {
        emitSafe(world, "townfolk:stocked", { actor: id, x: pos.x, y: pos.y });
        setReturning(job);
        return;
      }
      if ((herbCount + moonleafCount + emberRootCount) <= 0 || (thornCount + venomCount + moonleafCount + emberRootCount) <= 0 || !(herbChest > 0)) {
        emitSafe(world, "townfolk:sorted_herbs", { actor: id, x: pos.x, y: pos.y });
        setReturning(job);
        return;
      }
      if (moonleafCount > 0 && venomCount > 0) {
        consumeInventoryIdentity(world, herbChest, "reagent_moonleaf", 1);
        consumeInventoryIdentity(world, herbChest, "reagent_venom_frond", 1);
      } else if (emberRootCount > 0 && thornCount > 0) {
        consumeInventoryIdentity(world, herbChest, "reagent_ember_root", 1);
        consumeInventoryIdentity(world, herbChest, "reagent_thorn_pod", 1);
      } else {
        if (herbCount > 0) consumeInventoryIdentity(world, herbChest, "food_wild_herbs", 1);
        if (moonleafCount > 0) consumeInventoryIdentity(world, herbChest, "reagent_moonleaf", 1);
        else if (emberRootCount > 0) consumeInventoryIdentity(world, herbChest, "reagent_ember_root", 1);
        else if (venomCount > 0) consumeInventoryIdentity(world, herbChest, "reagent_venom_frond", 1);
        else if (thornCount > 0) consumeInventoryIdentity(world, herbChest, "reagent_thorn_pod", 1);
      }
      const potionKey = moonleafCount > 0 && venomCount > 0
        ? "potion_anti_venom"
        : emberRootCount > 0 && thornCount > 0
          ? "potion_resist_fire"
          : moonleafCount > 0
            ? "potion_mana"
            : emberRootCount > 0
              ? "potion_vigor"
              : venomCount > 0
                ? "potion_anti_venom"
                : thornCount > 0
                  ? (world.rand() < 0.5 ? "potion_stoneskin" : "potion_vigor")
                  : BREW_POTIONS[Math.floor(world.rand() * BREW_POTIONS.length)];
      const potionId = createItemById(world, potionKey);
      if (potionId) {
        world.add(potionId, Position, { x: pos.x, y: pos.y });
        const info = world.get(potionId, ItemInfo);
        if (info) info.identified = true;
        const baseValue = appraiseItemValue(world, potionId);
        const price = Math.ceil(baseValue * 1.3);
        world.add(potionId, Unpaid, { shopkeeperId: id, price });
        emitSafe(world, "townfolk:brewed", { actor: id, x: pos.x, y: pos.y, potion: potionKey });
      }
      setReturning(job);
      return;
    }
    default:
      setReturning(job);
      return;
  }
}

function handleReturning(world, id, pos, job) {
  if (nearPoint(pos, job.homeX, job.homeY, 2)) {
    setIdle(job, world);
    if (job.carrying) emitSafe(world, "townfolk:delivered", { actor: id, resource: job.carrying });
    job.carrying = "";
    job.carryCount = 0;
    return;
  }

  const moved = stepToward(world, id, pos, job.targetX, job.targetY);
  if (!moved) {
    job.stuckTurns++;
    if (job.stuckTurns >= MAX_STUCK_TURNS) setIdle(job, world);
    return;
  }
  job.stuckTurns = 0;
}

const BREW_STOCK_LIMIT = 10;
const BREW_POTIONS = ["potion_health", "potion_stoneskin", "potion_vigor", "potion_anti_venom"];

function countShopStock(world, shopkeeperId) {
  let count = 0;
  for (const [, unpaid] of world.query(Unpaid)) {
    if (unpaid.shopkeeperId === shopkeeperId) count++;
  }
  return count;
}

function findChestNear(world, x, y) {
  let chestId = 0;
  forEachInRadius(world, x, y, 1, (eid) => {
    if (chestId) return;
    if (world.has(eid, Inventory)) chestId = eid;
  });
  return chestId;
}

function handleDelivering(world, id, pos, job) {
  if (!job.carrying) {
    setIdle(job, world);
    return;
  }
  if (nearPoint(pos, job.deliverX, job.deliverY, 1)) {
    const chestId = findChestNear(world, job.deliverX, job.deliverY);
    const moved = chestId ? depositCarriedItems(world, id, chestId, job) : 0;
    if (!moved && carriedItemCount(world, id, job) <= 0) {
      job.carrying = "";
      job.carryCount = 0;
    }
    emitSafe(world, "townfolk:delivered", { actor: id, resource: job.carrying });
    if (carriedItemCount(world, id, job) <= 0) {
      job.carrying = "";
      job.carryCount = 0;
    }
    job.state = TOWNFOLK_STATES.returning;
    job.targetX = job.homeX;
    job.targetY = job.homeY;
    job.stuckTurns = 0;
    return;
  }
  const moved = stepToward(world, id, pos, job.targetX, job.targetY);
  if (!moved) {
    job.stuckTurns++;
    if (job.stuckTurns >= MAX_STUCK_TURNS) {
      job.state = TOWNFOLK_STATES.returning;
      job.targetX = job.homeX;
      job.targetY = job.homeY;
      job.stuckTurns = 0;
    }
    return;
  }
  job.stuckTurns = 0;
}

function getRoleWorkTarget(world, job) {
  const townState = getTownState(world);
  const weather = getWeather(world);
  const workBeat = Math.floor((Math.max(0, world.step | 0) % 24) / 6);
  if (weather === "heavy_rain" && isStormShelterRole(job.role)) {
    return { x: job.homeX, y: job.homeY, kind: "home", state: TOWNFOLK_STATES.returning, radius: 1 };
  }
  switch (job.role) {
    case TOWNFOLK_ROLES.farmer: {
      if (townState?.lowFood) {
        const crop = findReadyNode(world, job.workX, job.workY, 15,
          (n) => CROP_KINDS.has(n.kind));
        if (crop) {
          return { x: crop.x, y: crop.y, kind: "harvest_crop", state: TOWNFOLK_STATES.working, radius: 1 };
        }
      }
      if ((workBeat % 2) === 0) {
        // Harvest ready crops if any, then plant, then tend
        const crop = findReadyNode(world, job.workX, job.workY, 15,
          (n) => CROP_KINDS.has(n.kind));
        if (crop) {
          return { x: crop.x, y: crop.y, kind: "harvest_crop", state: TOWNFOLK_STATES.working, radius: 1 };
        }
        const plant = findNeedsPlantingNode(world, job.workX, job.workY, 15);
        if (plant) {
          return { x: plant.x, y: plant.y, kind: "plant_crop", state: TOWNFOLK_STATES.working, radius: 1 };
        }
        return { x: job.workX, y: job.workY, kind: "tend", state: TOWNFOLK_STATES.working, radius: 1 };
      }
      return { x: job.workAuxX, y: job.workAuxY, kind: "mill", state: TOWNFOLK_STATES.working, radius: 0 };
    }
    case TOWNFOLK_ROLES.woodcutter: {
      const tree = findReadyNode(world, job.workX, job.workY, WORK_RANGE,
        (n) => n.kind === "tree");
      if (tree) {
        return { x: tree.x, y: tree.y, kind: "chop", state: TOWNFOLK_STATES.working, radius: 1 };
      }
      return { x: job.workX, y: job.workY, kind: "chop", state: TOWNFOLK_STATES.working, radius: 1 };
    }
    case TOWNFOLK_ROLES.miner: {
      const ore = findReadyNode(world, job.workX, job.workY, 8,
        (n) => n.requiresTool === "dig");
      if (ore) {
        return { x: ore.x, y: ore.y, kind: "mine", state: TOWNFOLK_STATES.working, radius: 1 };
      }
      return { x: job.workX, y: job.workY, kind: "mine", state: TOWNFOLK_STATES.working, radius: 1 };
    }
    case TOWNFOLK_ROLES.smith:
      if (townState?.lowMaterials) {
        return { x: job.workAuxX, y: job.workAuxY, kind: "inspect", state: TOWNFOLK_STATES.working, radius: 1 };
      }
      return { x: job.workX, y: job.workY, kind: "forge_tools", state: TOWNFOLK_STATES.working, radius: 1 };
    case TOWNFOLK_ROLES.priest:
      if ((workBeat % 2) === 0) {
        return { x: job.workX, y: job.workY, kind: "minister", state: TOWNFOLK_STATES.working, radius: 1 };
      }
      return { x: job.workAuxX, y: job.workAuxY, kind: "pray", state: TOWNFOLK_STATES.working, radius: 0 };
    case TOWNFOLK_ROLES.barkeep: {
      // Approach the player to offer the rat quest
      const _pl = playerEntity(world);
      if (_pl) {
        const quest = getQuestRecord(world, RAT_INFESTATION_QUEST_ID, _pl.id);
        if (quest && String(quest.state?.node || "") === "offer"
            && String(quest.state?.status || "") === "active") {
          return { x: _pl.pos.x, y: _pl.pos.y, kind: "serve", state: TOWNFOLK_STATES.walking, radius: 2 };
        }
      }
      if ((workBeat % 2) === 0) {
        return { x: job.workX, y: job.workY, kind: "cook", state: TOWNFOLK_STATES.working, radius: 0 };
      }
      return { x: job.workAuxX, y: job.workAuxY, kind: "pour", state: TOWNFOLK_STATES.working, radius: 0 };
    }
    case TOWNFOLK_ROLES.mason: {
      const ledger = Object.values(getDestroyedTileLedger(world));
      let best = null;
      let bestDist = Infinity;
      for (const rec of ledger) {
        const d = manhattanScalar(rec.x, rec.y, job.homeX, job.homeY);
        if (d < bestDist) {
          bestDist = d;
          best = rec;
        }
      }
      if (best && bestDist <= 40) {
        return { x: best.x, y: best.y, kind: "repair", state: TOWNFOLK_STATES.working, radius: 0 };
      }
      return { x: job.workX, y: job.workY, kind: "inspect", state: TOWNFOLK_STATES.working, radius: 1 };
    }
    case TOWNFOLK_ROLES.herbalist: {
      const herb = findReadyNode(world, job.workX, job.workY, WORK_RANGE,
        (n) => n.kind === "herbs" || n.kind === "thorn_bramble" || n.kind === "venom_fern" || n.kind === "moonleaf" || n.kind === "ember_root");
      if (herb) {
        return { x: herb.x, y: herb.y, kind: "harvest_herb", state: TOWNFOLK_STATES.working, radius: 1 };
      }
      return { x: job.workAuxX, y: job.workAuxY, kind: "sort_herbs", state: TOWNFOLK_STATES.working, radius: 1 };
    }
    case TOWNFOLK_ROLES.alchemist: {
      const storage = _cachedStorage;
      const herbChest = storage.herb;
      const herbStock = herbChest > 0 ? countInventoryByIdentity(world, herbChest) : {};
      const canBrew = (herbStock.food_wild_herbs || 0) > 0
        || (herbStock.reagent_moonleaf || 0) > 0
        || (herbStock.reagent_ember_root || 0) > 0
        || (herbStock.reagent_thorn_pod || 0) > 0
        || (herbStock.reagent_venom_frond || 0) > 0;
      if (townState?.lowMedicine && canBrew) {
        return { x: job.workX, y: job.workY, kind: "brew", state: TOWNFOLK_STATES.working, radius: 1 };
      }
      if ((workBeat % 2) === 0) {
        return { x: job.workX, y: job.workY, kind: canBrew ? "brew" : "stock_shelves", state: TOWNFOLK_STATES.working, radius: 1 };
      }
      return { x: job.workAuxX, y: job.workAuxY, kind: "stock_shelves", state: TOWNFOLK_STATES.working, radius: 1 };
    }
    case TOWNFOLK_ROLES.enchantress:
      return { x: job.workX, y: job.workY, kind: "tend_stall", state: TOWNFOLK_STATES.working, radius: 0 };
    case TOWNFOLK_ROLES.fisher: {
      const storage = _cachedStorage;
      const tavernPos = getEntityPosition(world, storage.tavern);
      const tavernDrop = deliverNear(tavernPos);
      const spot = findFishableShoreSpot(job.workX, job.workY, WORK_RANGE);
      if (spot && tavernDrop) {
        return {
          x: spot.x,
          y: spot.y,
          kind: "fish",
          state: TOWNFOLK_STATES.working,
          radius: 0,
          deliverX: tavernDrop.x,
          deliverY: tavernDrop.y,
        };
      }
      return { x: job.workX, y: job.workY, kind: "fish", state: TOWNFOLK_STATES.working, radius: 1 };
    }
    case TOWNFOLK_ROLES.gem_vendor:
    case TOWNFOLK_ROLES.book_vendor:
    case TOWNFOLK_ROLES.general_vendor:
      return { x: job.workX, y: job.workY, kind: "tend_stall", state: TOWNFOLK_STATES.working, radius: 0 };
    case TOWNFOLK_ROLES.villager:
    default:
      {
        const haul = chooseVillagerHaul(world);
        if (haul) return haul;
      }
      if ((workBeat % 2) === 0) {
        return { x: job.workX, y: job.workY, kind: "garden", state: TOWNFOLK_STATES.working, radius: 1 };
      }
      return { x: job.workAuxX, y: job.workAuxY, kind: "haul", state: TOWNFOLK_STATES.working, radius: 1 };
  }
}

function getScheduleTarget(world, actorId, job) {
  if (shopHasCustomer(world, actorId)) {
    return { phase: "shop_customer", ...getRoleWorkTarget(world, job) };
  }
  const phase = getTownPhase(world.step);
  if (phase === "sleep") {
    return { phase, x: job.bedX || job.homeX, y: job.bedY || job.homeY, kind: "sleep", state: TOWNFOLK_STATES.sleeping, radius: 0 };
  }
  if (phase === "breakfast") {
    return { phase, x: job.homeX, y: job.homeY, kind: "home", state: TOWNFOLK_STATES.idle, radius: 1 };
  }
  if (phase === "pub") {
    return { phase, x: job.pubX || job.homeX, y: job.pubY || job.homeY, kind: "pub", state: TOWNFOLK_STATES.socializing, radius: 1 };
  }
  if (phase === "home") {
    return { phase, x: job.homeX, y: job.homeY, kind: "home", state: TOWNFOLK_STATES.returning, radius: 1 };
  }
  return { phase, ...getRoleWorkTarget(world, job) };
}

function emitRoleWork(world, id, pos, job, target) {
  switch (target.kind) {
    case "tend":
      emitSafe(world, "townfolk:tended", { actor: id, x: pos.x, y: pos.y });
      break;
    case "mill":
      emitSafe(world, "townfolk:milled", { actor: id, x: pos.x, y: pos.y });
      break;
    case "forge_tools":
      emitSafe(world, "townfolk:forged", { actor: id, x: pos.x, y: pos.y });
      break;
    case "minister":
    case "pray":
      emitSafe(world, "townfolk:blessed", { actor: id, x: pos.x, y: pos.y });
      break;
    case "cook":
      emitSafe(world, "townfolk:cooked", { actor: id, x: pos.x, y: pos.y });
      break;
    case "serve":
    case "pour":
      emitSafe(world, "townfolk:poured", { actor: id, x: pos.x, y: pos.y });
      break;
    case "haul":
    case "garden":
      emitSafe(world, "townfolk:worked", { actor: id, x: pos.x, y: pos.y, kind: target.kind });
      break;
    case "inspect":
      emitSafe(world, "townfolk:inspected", { actor: id, x: pos.x, y: pos.y });
      break;
    case "sort_herbs":
      emitSafe(world, "townfolk:sorted_herbs", { actor: id, x: pos.x, y: pos.y });
      break;
    case "stock_shelves":
      emitSafe(world, "townfolk:stocked", { actor: id, x: pos.x, y: pos.y });
      break;
    case "pub":
      emitSafe(world, "townfolk:unwound", { actor: id, x: pos.x, y: pos.y });
      break;
    case "sleep":
      emitSafe(world, "townfolk:slept", { actor: id, x: pos.x, y: pos.y });
      break;
    default:
      break;
  }

  if (
    target.kind === "chop"
    || target.kind === "mine"
    || target.kind === "repair"
    || target.kind === "harvest_crop"
    || target.kind === "plant_crop"
    || target.kind === "harvest_herb"
    || target.kind === "brew"
    || target.kind === "mill"
    || target.kind === "forge_tools"
    || target.kind === "cook"
    || target.kind === "fetch_water"
    || target.kind === "fish"
    || target.kind === "haul_flour"
    || target.kind === "haul_firewood"
    || target.kind === "haul_lumber"
  ) {
    job.workSiteKind = target.kind;
    job.workTurns = 0;
    handleWorking(world, id, pos, job);
    return;
  }

  job.workTurns = 2 + Math.floor(world.rand() * 3);
}

function handleScheduledTownfolk(world, id, pos, job) {
  const target = getScheduleTarget(world, id, job);
  const phaseChanged = target.phase !== job.lastPhase;
  if (Number.isFinite(target.deliverX)) job.deliverX = target.deliverX;
  if (Number.isFinite(target.deliverY)) job.deliverY = target.deliverY;

  // Let active delivery complete before schedule override
  if (!phaseChanged && job.state === TOWNFOLK_STATES.delivering && job.carrying) {
    handleDelivering(world, id, pos, job);
    return;
  }

  if (phaseChanged) {
    job.lastPhase = target.phase;
    job.workTurns = 0;
    job.stuckTurns = 0;
    job.routineKind = target.kind;
    if (job.carrying && carriedItemCount(world, id, job) > 0) {
      handleDelivering(world, id, pos, job);
      return;
    }
    if (job.carrying) {
      emitSafe(world, "townfolk:delivered", { actor: id, resource: job.carrying });
      job.carrying = "";
      job.carryCount = 0;
    }
    emitSafe(world, "townfolk:routine", { actor: id, phase: target.phase, kind: target.kind });

    // Shop vendors open their door when the work phase starts.
    if (target.phase === "work" && findOwnedShopRoomByActor(world, id)) {
      openOwnedShopDoors(world, id);
    }
  }

  job.targetX = target.x;
  job.targetY = target.y;
  job.workSiteKind = target.kind;
  job.routineKind = target.kind;

  const targetRadius = effectiveScheduleRadius(world, target.x, target.y, target.radius);
  if (!nearPoint(pos, target.x, target.y, targetRadius)) {
    job.state = TOWNFOLK_STATES.walking;
    const moved = stepToward(world, id, pos, target.x, target.y);
    if (!moved) {
      job.stuckTurns++;
      if (job.stuckTurns >= MAX_STUCK_TURNS) {
        job.stuckTurns = 0;
        job.state = target.state;
      }
      return;
    }
    job.stuckTurns = 0;
    return;
  }

  job.state = target.state;
  job.stuckTurns = 0;
  if (target.kind === "sleep" || target.kind === "home") return;
  if (job.workTurns > 0) {
    job.workTurns--;
    return;
  }
  emitRoleWork(world, id, pos, job, target);
}

const LANTERN_LAST_PHASE = Symbol.for("jshack:lanternLastPhase");

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function aiTownfolkSystem(world) {
  let depth = -1;
  for (const [, ds] of world.query(DungeonState)) {
    depth = ds.currentDepth ?? -1;
    break;
  }
  if (depth !== 0) return;
  detectTownBreachSightings(world);
  const emergencyProcessed = processTownEmergencyActors(world);

  // Cache storage container IDs for this tick (avoids 11 redundant world scans)
  _cachedStorage = findTownContainers(world);

  // Auto-toggle lanterns on phase transitions
  const phase = getTownPhase(world.step);
  if (phase !== world[LANTERN_LAST_PHASE]) {
    world[LANTERN_LAST_PHASE] = phase;
    const shouldBeLit = (phase === "sleep" || phase === "pub" || phase === "home");
    for (const [id, ident, os] of world.query(NamedIdentity, ObjectState)) {
      if (ident.identity !== "lantern_post") continue;
      const isLit = os.state === "lit";
      if (shouldBeLit !== isLit) {
        world.set(id, ObjectState, { state: shouldBeLit ? "lit" : "unlit" });
      }
    }
  }

  const _player = playerEntity(world);
  if (!_player) return;
  const playerPos = _player.pos;

  forEachInRadius(world, playerPos.x, playerPos.y, TOWNFOLK_RADIUS, (id, pos) => {
    if (emergencyProcessed.has(id)) return;
    const fac = world.get(id, Faction);
    if (fac?.key !== "townfolk") return;

    const job = world.get(id, TownfolkJob);
    if (!job) return;

    const spd = world.get(id, Speed);
    const actEvery = spd?.actEvery > 1 ? spd.actEvery : 1;
    if (actEvery > 1 && ((world.step + id) % actEvery) !== 0) return;
    if (world.has(id, MoveIntent)) return;

    // Armed state overrides all other behaviour
    if (job.state === TOWNFOLK_STATES.armed) {
      handleArmedTownfolk(world, id, pos, job);
      return;
    }

    if (job.state === TOWNFOLK_STATES.alarming) {
      handleBellRun(world, id, pos, job);
      return;
    }

    if (job.state === TOWNFOLK_STATES.hiding) {
      handleHiding(world, id, pos, job);
      return;
    }

    if (job.scheduleEnabled) {
      handleScheduledTownfolk(world, id, pos, job);
      return;
    }

    switch (job.state) {
      case TOWNFOLK_STATES.idle:
        handleIdle(world, id, pos, job);
        break;
      case TOWNFOLK_STATES.walking:
        handleWalking(world, id, pos, job);
        break;
      case TOWNFOLK_STATES.working:
        handleWorking(world, id, pos, job);
        break;
      case TOWNFOLK_STATES.returning:
        handleReturning(world, id, pos, job);
        break;
      case TOWNFOLK_STATES.delivering:
        handleDelivering(world, id, pos, job);
        break;
      default:
        break;
    }
  });
}

const BELL_INSTALLED = Symbol.for("jshack:bellListener:installed");

export function installBellListener(world) {
  if (!world || world[BELL_INSTALLED]) return;
  world[BELL_INSTALLED] = true;

  world.on("bell:rung", ({ actor, reason }) => {
    const state = townBreachState(world);
    const sightedMonsterId = state.sightedMonsterId | 0;
    applyTownAlarmResponse(world, Number(actor || 0) | 0, sightedMonsterId);
    emitSafe(world, "town:alarm", {
      actor: Number(actor || 0) | 0,
      reason: String(reason || "bell"),
      sightedMonsterId,
      activeTurns: BELL_GUARD_TURNS,
    });
  });
}
