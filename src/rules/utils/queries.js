import { Position } from "../components/Position.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { GroundStackOrder } from "../components/GroundStackOrder.js";
import { Player } from "../components/Player.js";
import { Inventory } from "../components/Inventory.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Collider } from "../components/Collider.js";
import { Vitality } from "../components/Vitality.js";
import { Faction } from "../components/Faction.js";
import { Anatomy } from "../components/Anatomy.js";
import { AggroState } from "../components/AggroState.js";
import { HazardArea } from "../components/HazardArea.js";
import { Not } from "../../lib/ecs-js/core.js";
import { isWalkable } from "../environment/dungeon/tileMap.js";
import { manhattanScalar } from "./distance.js";
import { entitiesAtPoint } from "./spatialIndex.js";

// ── Shared defined-query registry ─────────────────────────────────────────────
// WeakMap ensures each world instance gets its own set of handles, so tests
// that create multiple worlds never share stale state across runs.

/** @type {WeakMap<object, ReturnType<typeof _buildHandles>>} */
const _qCache = new WeakMap();

function _buildHandles(world) {
  return {
    allPositions:     world.defineQuery(Position),
    namedPositions:   world.defineQuery(Position, NamedIdentity),
    playerPosInv:     world.defineQuery(Player, Position, Inventory),
    positionFaction:  world.defineQuery(Position, Faction),
    playerPos:       world.defineQuery(Player, Position),
    factionActors:   world.defineQuery(Faction, Position, Vitality),
    aggroPositioned: world.defineQuery(AggroState, Position, Not(Player)),
    enemyListeners:  world.defineQuery(Anatomy, AggroState, Faction, Position)
                       .where((anat, aggro, fac) => fac.key === "enemy"),
    hazardAreas:     world.defineQuery(Position, HazardArea),
  };
}

function _q(world) {
  if (!_qCache.has(world)) _qCache.set(world, _buildHandles(world));
  return _qCache.get(world);
}

// ── Public query iterators ─────────────────────────────────────────────────────

/** All entities with Player + Position. */
export function queryPlayerPos(world)       { return _q(world).playerPos(); }

/** All entities with Position. */
export function queryAllPositions(world)    { return _q(world).allPositions(); }

/** All entities with Position + NamedIdentity. */
export function queryNamedPositions(world)  { return _q(world).namedPositions(); }

/** All players with Position + Inventory. */
export function queryPlayerPosInv(world)    { return _q(world).playerPosInv(); }

/** All entities with Position + Faction. */
export function queryPositionFaction(world) { return _q(world).positionFaction(); }

/** All entities with Faction + Position + Vitality. */
export function queryFactionActors(world)   { return _q(world).factionActors(); }

/** All non-player entities with AggroState + Position. */
export function queryAggroPositioned(world) { return _q(world).aggroPositioned(); }

/** All enemy entities with Anatomy + AggroState + Faction + Position. */
export function queryEnemyListeners(world)  { return _q(world).enemyListeners(); }

/** All entities with Position + HazardArea. */
export function queryHazardAreas(world)     { return _q(world).hazardAreas(); }

// ── Utility functions ──────────────────────────────────────────────────────────

export function itemsAt(world, x, y) {
  const ids = entitiesAtPoint(world, x, y);
  const rows = [];
  let idx = 0;
  for (const id of ids) {
    if (!world.has(id, ItemInfo)) continue;
    const seq = Number(world.get(id, GroundStackOrder)?.seq || 0) | 0;
    rows.push({ id, seq, idx: idx++ });
  }
  rows.sort((a, b) => {
    if (a.seq !== b.seq) return b.seq - a.seq;
    return a.idx - b.idx;
  });
  return rows.map((row) => row.id);
}

export function playerEntity(world) {
  for (const [id, _pl, pos] of queryPlayerPos(world)) {
    if (pos && Number.isInteger(pos.x) && Number.isInteger(pos.y)) {
      return { id, pos: { x: pos.x, y: pos.y } };
    }
  }
  return null;
}

/**
 * Find the nearest valid tile around a source point.
 * Valid means walkable terrain and no solid/living occupant.
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {{x:number, y:number}} source
 * @param {{
 *   maxDistance?: number,
 *   exclude?: Array<{x:number, y:number}>
 * }} [opts]
 */
export function findNearestValidTileAround(world, source, opts = {}) {
  const maxDistance = Math.max(0, opts.maxDistance ?? 1);
  const excluded = new Set((opts.exclude || []).map((p) => `${p.x},${p.y}`));
  const blocked = new Set();

  for (const [id, pos] of world.query(Position)) {
    const col = world.get(id, Collider);
    if (col?.solid) blocked.add(`${pos.x},${pos.y}`);

    const vit = world.get(id, Vitality);
    if (vit && (vit.hp ?? 0) > 0) blocked.add(`${pos.x},${pos.y}`);
  }

  const candidates = [];
  for (let dy = -maxDistance; dy <= maxDistance; dy++) {
    for (let dx = -maxDistance; dx <= maxDistance; dx++) {
      const x = source.x + dx;
      const y = source.y + dy;
      const dist = manhattanScalar(source.x, source.y, x, y);
      candidates.push({ x, y, dist, axisBias: (dx === 0 || dy === 0) ? 0 : 1 });
    }
  }

  candidates.sort((a, b) => a.dist - b.dist || a.axisBias - b.axisBias);

  for (const p of candidates) {
    const key = `${p.x},${p.y}`;
    if (excluded.has(key)) continue;
    if (!isWalkable(p.x, p.y)) continue;
    if (blocked.has(key)) continue;
    return { x: p.x, y: p.y };
  }

  return null;
}
