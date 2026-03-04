// rules/environment/dungeon/transition.js
// Handles level transitions (ascending/descending stairs).

import { DungeonState } from '../../components/DungeonState.js';
import { Position } from '../../components/Position.js';
import { Player } from '../../components/Player.js';
import { Pet } from '../../components/Pet.js';
import { PetState } from '../../components/PetState.js';
import { NamedIdentity } from '../../components/NamedIdentity.js';
import { clearAll as clearTileMap } from './tileMap.js';
import { clearExplored, saveExplored, restoreExplored, degradeExplored } from './exploredMap.js';
import { generateFloor } from './index.js';
import { clearSpatialIndex } from '../../utils/spatialIndex.js';
import { invalidateTileQueryCache } from '../../utils/tileQueryCache.js';
import { applySnapshot, serializeEntities } from '../../../lib/ecs-js/serialization.js';
import { destroySubtree } from '../../../lib/ecs-js/hierarchy.js';

/** @type {Map<number, Map<string, Uint8Array>>} explored snapshots keyed by depth */
const _exploredCache = new Map();
/** @type {Map<number, { snapshot: any, order: number[] }>} floor entity snapshots keyed by depth */
const _floorEntityCache = new Map();

/** Max floor entity snapshots held in the JS heap; older entries are evicted to localStorage. */
const MAX_MEMORY_FLOORS = 5;

/** @param {number} worldSeed @param {number} depth @returns {string} */
function _floorStorageKey(worldSeed, depth) {
  return `jshack:floor:${(worldSeed >>> 0).toString(16)}:${depth}`;
}

/** @param {number} worldSeed @param {number} depth @param {object} entry */
function _persistFloor(worldSeed, depth, entry) {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(_floorStorageKey(worldSeed, depth), JSON.stringify(entry)); } catch { /* quota exceeded — skip */ }
}

/** @param {number} worldSeed @param {number} depth @returns {{ snapshot: any, order: number[] }|null} */
function _loadPersistedFloor(worldSeed, depth) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(_floorStorageKey(worldSeed, depth));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** Clear all in-memory and localStorage floor caches (call on new game). */
export function clearFloorCache() {
  _floorEntityCache.clear();
  _exploredCache.clear();
  if (typeof localStorage === 'undefined') return;
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('jshack:floor:')) keys.push(k);
  }
  for (const k of keys) localStorage.removeItem(k);
}

/** Evict in-memory entries farthest from `currentDepth` until within MAX_MEMORY_FLOORS.
 *  Evicted entries are already persisted to localStorage; just drop the heap reference.
 * @param {number} currentDepth */
function _evictMemoryFloors(currentDepth) {
  while (_floorEntityCache.size > MAX_MEMORY_FLOORS) {
    let furthestDepth = null, maxDist = -1;
    for (const d of _floorEntityCache.keys()) {
      const dist = Math.abs(d - currentDepth);
      if (dist > maxDist) { maxDist = dist; furthestDepth = d; }
    }
    if (furthestDepth === null) break;
    _floorEntityCache.delete(furthestDepth);
  }
}

/**
 * Build a runtime component registry from currently known stores.
 * @param {import('../../../lib/ecs-js/index.js').World} world
 * @returns {Map<string, any>}
 */
function _buildSnapshotRegistry(world) {
  const reg = new Map();
  for (const [, comp] of world._components) {
    if (!comp || typeof comp.name !== 'string' || !comp.name) continue;
    reg.set(comp.name, comp);
  }
  return reg;
}

/**
 * Transition the dungeon to a new depth.
 *
 * Steps:
 * 1. Save explored state for the current floor
 * 2. Destroy all floor entities
 * 3. Clear tile data and fog-of-war
 * 4. Generate new floor
 * 5. Restore explored state if the floor was previously visited
 * 6. Move player to destination position
 *
 * @param {import('../../../lib/ecs-js/index.js').World} world
 * @param {number} newDepth
 * @param {{x: number, y: number}} destinationPos - world coords for player placement
 * @param {{direction?: 'up'|'down', stairPos?: {x:number,y:number}|null, tombstoneRepo?: Object, onProgress?: (progress: { phase: 'chunks', depth: number, processed: number, total: number, cx?: number, cy?: number }) => void}} [opts]
 */
export function transitionToDepth(world, newDepth, destinationPos, opts = {}) {
  // Find dungeon state
  let dungeonId = null;
  let ds = null;
  for (const [id, state] of world.query(DungeonState)) {
    dungeonId = id;
    ds = state;
    break;
  }

  // Compute worldSeed early — needed for floor cache persistence keys.
  const worldSeed = ds ? ds.worldSeed : (world.seed >>> 0);

  // Save explored map for the current floor before clearing
  const currentDepth = ds ? ds.currentDepth : 0;
  if (ds && Array.isArray(ds.floorEntityIds)) {
    if (currentDepth > 0) _exploredCache.set(currentDepth, saveExplored());
    const floorIds = ds.floorEntityIds
      .filter((/** @type {number} */ id) => Number.isInteger(id) && id > 0 && world.isAlive(id));
    const entry = {
      snapshot: serializeEntities(world, floorIds, { note: `floor_depth_${currentDepth}` }),
      order: floorIds.slice(),
    };
    _persistFloor(worldSeed, currentDepth, entry);
    _floorEntityCache.set(currentDepth, entry);
    _evictMemoryFloors(newDepth);
  }

  // Destroy all entities from the current floor (destroySubtree cascades to
  // hierarchy children, e.g. monsters spawned at runtime by spawner nests).
  if (ds && Array.isArray(ds.floorEntityIds)) {
    for (const eid of ds.floorEntityIds) {
      try { destroySubtree(world, eid); } catch (_) { /* already gone */ }
    }
  }

  // Sweep orphaned floor-local entities not captured in floorEntityIds:
  // runtime-spawned monsters whose spawner was killed, web trail entities,
  // sarcophagus skeletons, loot drops, etc. The player, DungeonState,
  // and pet entities are permanent and must be preserved.
  for (const [eid] of world.query(Position)) {
    if (world.has(eid, Player) || world.has(eid, DungeonState) || world.has(eid, Pet)) continue;
    try { if (world.isAlive(eid)) destroySubtree(world, eid); } catch (_) {}
  }

  // Clear tile data and fog-of-war
  clearTileMap();
  clearExplored();
  clearSpatialIndex(world);
  invalidateTileQueryCache(world);

  // Generate the new floor, inheriting down-stair positions from the current floor
  // when descending so up-stairs land at the same world coordinates.
  const tombstoneRepo = opts.tombstoneRepo || null;
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
  const isDescending = newDepth > currentDepth;
  const priorDownStairPositions = (isDescending && Array.isArray(ds?.downStairPositions) && ds.downStairPositions.length > 0)
    ? ds.downStairPositions : null;
  const { spawnX, spawnY, entityIds: generatedEntityIds, downStairPositions: newDownStairPositions } =
    generateFloor(world, worldSeed, newDepth, tombstoneRepo, onProgress, priorDownStairPositions);
  let entityIds = generatedEntityIds;

  const cachedFloor = _floorEntityCache.get(newDepth) ?? _loadPersistedFloor(worldSeed, newDepth);
  if (cachedFloor?.snapshot?.v === 1 && cachedFloor.snapshot.comps) {
    /** @type {number[]} */
    const createdIds = [];
    try {
      /** @type {Map<number, number>} */
      const oldToNew = new Map();
      const prevTime = +world.time || 0;
      const prevFrame = world.frame | 0;

      applySnapshot(world, cachedFloor.snapshot, _buildSnapshotRegistry(world), {
        mode: 'append',
        skipUnknown: true,
        remapId(oldId) {
          const id = world.create();
          oldToNew.set(oldId, id);
          createdIds.push(id);
          return id;
        },
      });

      world.time = prevTime;
      world.frame = prevFrame;

      const order = Array.isArray(cachedFloor.order) && cachedFloor.order.length
        ? cachedFloor.order
        : (Array.isArray(cachedFloor.snapshot.alive) ? cachedFloor.snapshot.alive : []);
      const restoredIds = [];
      for (const oldId of order) {
        const eid = oldToNew.get(Number(oldId) | 0) || 0;
        if (eid > 0 && world.isAlive(eid)) restoredIds.push(eid);
      }
      if (restoredIds.length <= 0) throw new Error('restored floor is empty');

      const hasStairAnchor = restoredIds.some((eid) => {
        const ni = world.get(eid, NamedIdentity);
        return ni?.identity === 'stair_up' || ni?.identity === 'stair_down';
      });
      if (!hasStairAnchor) throw new Error('restored floor missing stair anchor');

      for (const eid of generatedEntityIds) {
        try { world.destroy(eid); } catch {} // ECS: entity may already be destroyed
      }

      entityIds = restoredIds;
    } catch {
      for (const eid of createdIds) {
        try { world.destroy(eid); } catch {} // ECS: entity may already be destroyed
      }
      entityIds = generatedEntityIds;
    }
  }

  // Restore explored state if this floor was previously visited
  const savedExplored = _exploredCache.get(newDepth);
  if (savedExplored) {
    restoreExplored(savedExplored);
  }

  // Determine arrival position on the new floor.
  if (opts.stairPos) {
    // Positional-identity contract: the matching stair is at the exact same world
    // coordinates as the one the player stepped on (guaranteed by generateFloorPlan
    // when priorDownStairPositions is passed, or by snapshot restoration).
    destinationPos = opts.stairPos;
  } else if (opts.direction) {
    // Fallback for single-stair floors or callers that don't supply stairPos:
    // find the first stair of the matching type on the new floor.
    const arrivalIdentity = opts.direction === 'down' ? 'stair_up' : 'stair_down';
    let found = false;
    for (const [, pos, ni] of world.query(Position, NamedIdentity)) {
      if (ni.identity === arrivalIdentity) {
        destinationPos = { x: pos.x, y: pos.y };
        found = true;
        break;
      }
    }
    if (!found) {
      destinationPos = { x: spawnX, y: spawnY };
    }
  }

  // Update dungeon state
  if (dungeonId != null) {
    world.mutate(dungeonId, DungeonState, r => {
      r.currentDepth = newDepth;
      r.floorEntityIds = entityIds;
      r.downStairPositions = newDownStairPositions || [];
    });
  }

  // Move player to destination
  for (const [id] of world.query(Player)) {
    world.set(id, Position, { x: destinationPos.x, y: destinationPos.y });
    break;
  }

  // Move pets to destination and reset floor-specific state
  for (const [id] of world.query(Pet, PetState)) {
    world.set(id, Position, { x: destinationPos.x, y: destinationPos.y });
    world.mutate(id, PetState, r => {
      if (r.state === 'fetching' || r.state === 'returning' || r.state === 'guarding' || r.state === 'staying') {
        r.state = 'following';
      }
      r.targetX = null;
      r.targetY = null;
      r.targetItemId = 0;
      r.lastPlayerX = destinationPos.x;
      r.lastPlayerY = destinationPos.y;
    });
  }

  world.emit?.('dungeon:transitioned', { depth: newDepth, pos: destinationPos });
  invalidateTileQueryCache(world);
  // Transition can run in isolated tests/worlds with no scheduler installed.
  if (typeof world.scheduler === 'function') {
    world.tick(1);
  }
}

/**
 * Degrade explored memory on a random floor (current or any cached).
 * Each explored tile on the chosen floor has `fraction` chance of being forgotten.
 *
 * @param {() => number} rngFn - returns float in [0,1)
 * @param {{fraction?: number}} [opts]
 * @returns {{depth: number, fraction: number}} which floor was hit
 */
export function degradeFloorMemory(rngFn, opts = {}) {
  const fraction = Math.max(0, Math.min(1, opts.fraction ?? 0.3));

  // Candidates: every cached depth + 0 as sentinel for "current floor"
  const candidates = [..._exploredCache.keys(), 0];
  const pick = candidates[Math.floor(rngFn() * candidates.length)];

  if (pick === 0) {
    // Degrade the live explored map (current floor)
    degradeExplored(fraction, rngFn);
    return { depth: 0, fraction };
  }

  // Degrade a cached floor's snapshot in place
  const snap = _exploredCache.get(pick);
  if (snap) {
    for (const chunk of snap.values()) {
      for (let i = 0; i < chunk.length; i++) {
        if (chunk[i] && rngFn() < fraction) {
          chunk[i] = 0;
        }
      }
    }
  }
  return { depth: pick, fraction };
}
