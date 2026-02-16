// rules/environment/dungeon/transition.js
// Handles level transitions (ascending/descending stairs).

import { DungeonState } from '../../components/DungeonState.js';
import { Position } from '../../components/Position.js';
import { Player } from '../../components/Player.js';
import { NamedIdentity } from '../../components/NamedIdentity.js';
import { clearAll as clearTileMap } from './tileMap.js';
import { clearExplored, saveExplored, restoreExplored, degradeExplored } from './exploredMap.js';
import { generateFloor } from './index.js';
import { clearSpatialIndex } from '../../utils/spatialIndex.js';
import { invalidateTileQueryCache } from '../../utils/tileQueryCache.js';
import { applySnapshot, serializeEntities } from '../../../lib/ecs-js/serialization.js';

/** @type {Map<number, Map<string, Uint8Array>>} explored snapshots keyed by depth */
const _exploredCache = new Map();
/** @type {Map<number, { snapshot: any, order: number[] }>} floor entity snapshots keyed by depth */
const _floorEntityCache = new Map();

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
 * @param {{direction?: 'up'|'down', tombstoneRepo?: Object, onProgress?: (progress: { phase: 'chunks', depth: number, processed: number, total: number, cx?: number, cy?: number }) => void}} [opts]
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

  // Save explored map for the current floor before clearing
  const currentDepth = ds ? ds.currentDepth : 0;
  if (ds && Array.isArray(ds.floorEntityIds)) {
    if (currentDepth > 0) _exploredCache.set(currentDepth, saveExplored());
    const floorIds = ds.floorEntityIds
      .filter((id) => Number.isInteger(id) && id > 0 && world.isAlive(id));
    _floorEntityCache.set(currentDepth, {
      snapshot: serializeEntities(world, floorIds, { note: `floor_depth_${currentDepth}` }),
      order: floorIds.slice(),
    });
  }

  // Destroy all entities from the current floor
  if (ds && Array.isArray(ds.floorEntityIds)) {
    for (const eid of ds.floorEntityIds) {
      try { world.destroy(eid); } catch (_) { /* already gone */ }
    }
  }

  // Clear tile data and fog-of-war
  clearTileMap();
  clearExplored();
  clearSpatialIndex(world);
  invalidateTileQueryCache(world);

  // Generate the new floor
  const worldSeed = ds ? ds.worldSeed : (world.seed >>> 0);
  const tombstoneRepo = opts.tombstoneRepo || null;
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
  const { spawnX, spawnY, entityIds: generatedEntityIds } = generateFloor(world, worldSeed, newDepth, tombstoneRepo, onProgress);
  let entityIds = generatedEntityIds;

  const cachedFloor = _floorEntityCache.get(newDepth);
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
        try { world.destroy(eid); } catch {}
      }

      entityIds = restoredIds;
    } catch {
      for (const eid of createdIds) {
        try { world.destroy(eid); } catch {}
      }
      entityIds = generatedEntityIds;
    }
  }

  // Restore explored state if this floor was previously visited
  const savedExplored = _exploredCache.get(newDepth);
  if (savedExplored) {
    restoreExplored(savedExplored);
  }

  // If direction provided, arrive at the matching stair on the new floor
  // (descending → land on up-stair; ascending → land on down-stair)
  if (opts.direction) {
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
    });
  }

  // Move player to destination
  for (const [id] of world.query(Player)) {
    world.set(id, Position, { x: destinationPos.x, y: destinationPos.y });
    break;
  }

  world.emit?.('dungeon:transitioned', { depth: newDepth, pos: destinationPos });
  invalidateTileQueryCache(world);
  world.tick(1);
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
