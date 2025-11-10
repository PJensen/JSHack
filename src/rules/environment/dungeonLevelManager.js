import { DungeonGeometry } from "../components/DungeonGeometry.js";
import { ensureGeometryKernel, setGeometryKernel } from "./worldGeometry.js";
import { GeometryKernel } from "./GeometryKernel.js";
import { serializeEntities, applySnapshot, makeRegistry } from "../../lib/ecs-js/serialization.js";

const LEVEL_BUILDERS_KEY = Symbol.for("jshack.dungeon.levelBuilders");
const LEVEL_ENTITIES_KEY = Symbol.for("jshack.dungeon.levelEntities");
const ACTIVE_LEVEL_KEY = Symbol.for("jshack.dungeon.activeLevel");
const LEVEL_STATE_KEY = Symbol.for("jshack.dungeon.levelState");
const GEOM_SERIAL_KEY = Symbol.for("jshack.dungeon.geomSerial");

function getLevelStateMap(world) {
  if (!world[LEVEL_STATE_KEY]) {
    world[LEVEL_STATE_KEY] = new Map();
  }
  return world[LEVEL_STATE_KEY];
}

function ensureLevelState(world, depth) {
  const map = getLevelStateMap(world);
  let state = map.get(depth);
  if (!state) {
    state = { snapshot: null, geometry: null, info: null };
    map.set(depth, state);
  }
  return state;
}

function getBuilderMap(world) {
  if (!world[LEVEL_BUILDERS_KEY]) {
    world[LEVEL_BUILDERS_KEY] = new Map();
  }
  return world[LEVEL_BUILDERS_KEY];
}

function setActiveLevelMeta(world, meta) {
  world[ACTIVE_LEVEL_KEY] = meta;
}

function getActiveLevelMeta(world) {
  return world[ACTIVE_LEVEL_KEY] || null;
}

function getTrackedEntitiesMap(world) {
  if (!world[LEVEL_ENTITIES_KEY]) {
    world[LEVEL_ENTITIES_KEY] = new Map();
  }
  return world[LEVEL_ENTITIES_KEY];
}

function setTrackedEntities(world, depth, ids) {
  const map = getTrackedEntitiesMap(world);
  map.set(depth, new Set(ids));
}

function trackedEntities(world, depth) {
  return getTrackedEntitiesMap(world).get(depth) || null;
}

function captureActiveLevelState(world) {
  const active = getActiveLevelMeta(world);
  if (!active) return;
  const tracked = trackedEntities(world, active.depth);
  if (!tracked || tracked.size === 0) return;
  const ids = Array.from(tracked);
  if (!ids.length) return;
  const snapshot = serializeEntities(world, ids);
  const state = ensureLevelState(world, active.depth);
  state.snapshot = snapshot;
  const geom = getCurrentGeometryComponent(world);
  if (geom) state.geometry = cloneGeometrySnapshot(geom);
}

function cleanupActiveLevel(world) {
  const active = getActiveLevelMeta(world);
  if (!active) return;
  const tracked = trackedEntities(world, active.depth);
  if (!tracked) return;
  for (const id of tracked) {
    if (world.alive.has(id)) {
      try { world.destroy(id); } catch {}
    }
  }
  tracked.clear();
}

function applyGeometrySnapshot(world, snapshot) {
  if (!snapshot) return null;
  const payload = cloneGeometrySnapshot(snapshot);
  const serial = nextGeometrySerial(world);
  // Ensure a brand-new identity for render caches
  payload.seed = ((payload.seed >>> 0) ^ (serial * 0x9e3779b9)) >>> 0;
  payload.mbrVersion = serial;
  payload.moveVersion = serial;
  payload.occlVersion = serial;
  const entity = ensureDungeonEntity(world);
  if (world.has(entity, DungeonGeometry)) {
    world.set(entity, DungeonGeometry, payload);
  } else {
    world.add(entity, DungeonGeometry, payload);
  }
  // Install a fresh kernel instance to avoid cross-level mutation
  const fresh = new GeometryKernel(payload.options || {});
  fresh.deserialize(payload);
  setGeometryKernel(world, fresh);
  return payload;
}

function ensureDungeonEntity(world) {
  const key = Symbol.for("jshack.dungeon.entity");
  if (!world[key]) {
    world[key] = world.create();
  }
  return world[key];
}

/**
 * Register a lazy builder for a dungeon depth.
 * @param {import('../../lib/ecs-js').World} world
 * @param {number} depth
 * @param {(world:import('../../lib/ecs-js').World, ctx:{ depth:number, previousDepth:number|null, entryPoint?:{x:number,y:number} })=>({ geometry?:any, entities?:number[], playerSpawn?:{x:number,y:number}, meta?:any }|void)} builder
 */
export function registerDungeonLevel(world, depth, builder) {
  if (!Number.isFinite(depth)) throw new Error("registerDungeonLevel: depth must be a number");
  if (typeof builder !== "function") throw new Error("registerDungeonLevel: builder must be a function");
  const map = getBuilderMap(world);
  map.set(depth | 0, builder);
}

/**
 * Activate the requested dungeon level by running its builder, storing geometry, and tracking spawned entities.
 * @param {import('../../lib/ecs-js').World} world
 * @param {number} depth
 * @param {{ entryPoint?: {x:number,y:number} }} [opts]
 */
export function activateDungeonLevel(world, depth, opts = {}) {
  const targetDepth = depth | 0;
  const builders = getBuilderMap(world);
  const previous = getActiveLevelMeta(world);

  if (previous && previous.depth === targetDepth) {
    return previous.info || {};
  }

  // Tear down previous level's tracked entities only
  cleanupActiveLevel(world);

  const builder = builders.get(targetDepth);
  if (!builder) {
    throw new Error(`activateDungeonLevel: no builder registered for depth ${targetDepth}`);
  }
  const ctx = { depth: targetDepth, previousDepth: previous ? previous.depth : null, entryPoint: opts.entryPoint };
  const result = builder(world, ctx) || {};

  // Apply fresh geometry every time to avoid stale state
  if (result.geometry) {
    applyGeometrySnapshot(world, result.geometry);
  }

  const ids = collectEntityIds(result.entities);
  setTrackedEntities(world, targetDepth, ids);

  // Cache last info per depth (without sharing geometry refs)
  const lvlState = ensureLevelState(world, targetDepth);
  lvlState.info = { ...result, geometry: result.geometry ? cloneGeometrySnapshot(result.geometry) : null };
  lvlState.snapshot = null; // disable entity snapshotting for now
  lvlState.geometry = result.geometry ? cloneGeometrySnapshot(result.geometry) : null;

  setActiveLevelMeta(world, { depth: targetDepth, info: lvlState.info });
  return lvlState.info;
}

export function getActiveDungeonLevel(world) {
  const meta = getActiveLevelMeta(world);
  return meta ? meta.depth : null;
}

export function getActiveLevelInfo(world) {
  const meta = getActiveLevelMeta(world);
  return meta ? meta.info || {} : {};
}

export function resetLevelGeometry(world) {
  const kernel = ensureGeometryKernel(world, { seed: world.seed >>> 0 });
  kernel.clear();
  setGeometryKernel(world, kernel);
  applyGeometrySnapshot(world, kernel.snapshot());
}

// Snapshot/restore temporarily disabled until geometry swap is stable
function restoreSnapshot() { return new Set(); }

function buildComponentRegistry(world) {
  const comps = [];
  for (const [, store] of world._store) {
    if (store?._comp) comps.push(store._comp);
  }
  return makeRegistry(...comps);
}

function collectEntityIds(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const visit = (val) => {
    if (Array.isArray(val)) {
      for (const inner of val) visit(inner);
      return;
    }
    if (Number.isInteger(val)) out.push(val);
  };
  list.forEach(visit);
  return out;
}

function cloneGeometrySnapshot(snapshot) {
  if (!snapshot) return null;
  try {
    return JSON.parse(JSON.stringify(snapshot));
  } catch {
    return {
      seed: snapshot.seed,
      mbrVersion: snapshot.mbrVersion,
      moveVersion: snapshot.moveVersion,
      occlVersion: snapshot.occlVersion,
      mbr: snapshot.mbr ? { ...snapshot.mbr } : null,
      primitives: Array.isArray(snapshot.primitives) ? snapshot.primitives.map((p) => JSON.parse(JSON.stringify(p))) : [],
      meta: snapshot.meta ? JSON.parse(JSON.stringify(snapshot.meta)) : null,
      options: snapshot.options ? { ...snapshot.options } : null,
    };
  }
}

function nextGeometrySerial(world) {
  const current = (world[GEOM_SERIAL_KEY] | 0) + 1;
  world[GEOM_SERIAL_KEY] = current;
  return current;
}

function getCurrentGeometryComponent(world) {
  for (const [, geom] of world.query(DungeonGeometry)) {
    if (geom) return geom;
  }
  return null;
}
