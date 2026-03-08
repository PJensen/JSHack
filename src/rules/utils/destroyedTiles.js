import { DungeonState } from "../components/DungeonState.js";

export const ROOF_BURN_TURNS = 8;

/**
 * @param {number} x
 * @param {number} y
 */
export function destroyedTileKey(x, y) {
  return `${x | 0},${y | 0}`;
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
export function getDungeonStateRecord(world) {
  for (const [, ds] of world.query(DungeonState)) return ds;
  return null;
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @returns {Record<string, any>}
 */
export function getDestroyedTileLedger(world) {
  return getDungeonStateRecord(world)?.destroyedTiles || {};
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} x
 * @param {number} y
 */
export function getDestroyedTileRecord(world, x, y) {
  return getDestroyedTileLedger(world)[destroyedTileKey(x, y)] || null;
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {{ x:number, y:number, originalTile:number, currentTile:number, destroyedAtTurn?:number, burnedKind?:string, cause?:string, sourceId?:number, sourceKind?:string, roofTurnsLeft?:number }} rec
 */
export function markDestroyedTile(world, rec) {
  const ds = getDungeonStateRecord(world);
  if (!ds) return null;
  const key = destroyedTileKey(rec.x, rec.y);
  const prev = ds.destroyedTiles?.[key] || null;
  const next = {
    x: rec.x | 0,
    y: rec.y | 0,
    originalTile: Number.isFinite(prev?.originalTile) ? prev.originalTile : (rec.originalTile | 0),
    currentTile: rec.currentTile | 0,
    destroyedAtTurn: Number.isFinite(prev?.destroyedAtTurn) ? prev.destroyedAtTurn : (Number.isFinite(rec.destroyedAtTurn) ? (rec.destroyedAtTurn | 0) : 0),
    burnedKind: String(rec.burnedKind || prev?.burnedKind || "terrain"),
    cause: String(rec.cause || prev?.cause || ""),
    sourceId: Number.isFinite(rec.sourceId) ? (rec.sourceId | 0) : (Number(prev?.sourceId || 0) | 0),
    sourceKind: String(rec.sourceKind || prev?.sourceKind || ""),
    roofTurnsLeft: Math.max(
      Number(prev?.roofTurnsLeft || 0) | 0,
      Number(rec.roofTurnsLeft || 0) | 0,
    ),
  };
  ds.destroyedTiles = {
    ...(ds.destroyedTiles || {}),
    [key]: next,
  };
  return next;
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
export function tickDestroyedTileLedger(world) {
  const ds = getDungeonStateRecord(world);
  if (!ds || !ds.destroyedTiles || typeof ds.destroyedTiles !== "object") return;
  const next = {};
  let changed = false;
  for (const [key, rec] of Object.entries(ds.destroyedTiles)) {
    const roofTurnsLeft = Math.max(0, (Number(rec?.roofTurnsLeft || 0) | 0) - 1);
    if (roofTurnsLeft !== (Number(rec?.roofTurnsLeft || 0) | 0)) changed = true;
    next[key] = roofTurnsLeft > 0 ? { ...rec, roofTurnsLeft } : { ...rec, roofTurnsLeft: 0 };
  }
  if (changed) ds.destroyedTiles = next;
}
