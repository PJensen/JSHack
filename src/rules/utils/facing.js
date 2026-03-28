import { Facing } from "../components/Facing.js";
import { BaseStats } from "../components/BaseStats.js";
import { FacingRules } from "../components/FacingRules.js";
import { Brain } from "../components/Brain.js";

export const FACING_CONE_BASE_DEG = 200;
export const FACING_CONE_FALLBACK_PERCEPTION = 5;
export const FACING_CONE_MIN_DEG = 200;
export const FACING_CONE_MAX_DEG = 200;
export const FACING_CONE_GRID_BIAS_DEG = 8;
export const FOV_CONE_DISABLED_KEY = Symbol.for("jshack:debug:fovCone:disabled");

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * @param {number} dx
 * @param {number} dy
 * @returns {{dx:number,dy:number}|null}
 */
export function normalizeFacingVector(dx, dy) {
  const ndx = Math.sign(Number(dx || 0));
  const ndy = Math.sign(Number(dy || 0));
  if (ndx === 0 && ndy === 0) return null;
  return { dx: ndx, dy: ndy };
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} entityId
 * @returns {{dx:number,dy:number}|null}
 */
export function getNormalizedEntityFacing(world, entityId) {
  const id = Number(entityId || 0) | 0;
  if (!(id > 0)) return null;
  const facing = world.get(id, Facing);
  if (!facing) return null;
  return normalizeFacingVector(facing.dx, facing.dy);
}

/**
 * @param {number} _perception - Reserved for future perception-based scaling.
 * @param {{
 *   baseDeg?: number,
 *   baseline?: number,
 *   degPerPoint?: number,
 *   minDeg?: number,
 *   maxDeg?: number,
 * }} [opts]
 */
export function perceptionToFacingConeDegrees(_perception, opts = {}) {
  const hasOverrides = opts.baseDeg != null || opts.minDeg != null || opts.maxDeg != null;
  if (!hasOverrides) return FACING_CONE_BASE_DEG;
  const baseDeg = Number(opts.baseDeg ?? FACING_CONE_BASE_DEG);
  const minDeg = Number(opts.minDeg ?? FACING_CONE_MIN_DEG);
  const maxDeg = Number(opts.maxDeg ?? FACING_CONE_MAX_DEG);
  return clamp(baseDeg, minDeg, maxDeg);
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} entityId
 * @param {{
 *   fallbackPerception?: number,
 *   baseDeg?: number,
 *   baseline?: number,
 *   degPerPoint?: number,
 *   minDeg?: number,
 *   maxDeg?: number,
 * }} [opts]
 */
export function getEntityFacingConeDegrees(world, entityId, opts = {}) {
  if (world?.[FOV_CONE_DISABLED_KEY]) return 360;
  const id = Number(entityId || 0) | 0;
  const fallbackPerception = Number(opts.fallbackPerception ?? FACING_CONE_FALLBACK_PERCEPTION);
  const baseStats = (id > 0) ? world.get(id, BaseStats) : null;
  const perception = Number(baseStats?.perception ?? fallbackPerception);
  return perceptionToFacingConeDegrees(perception, opts);
}

/**
 * Canonical FOV cone read path.
 * Supports per-entity override via Brain.fovConeDegrees.
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} entityId
 * @param {{
 *   fallbackPerception?: number,
 *   baseDeg?: number,
 *   baseline?: number,
 *   degPerPoint?: number,
 *   minDeg?: number,
 *   maxDeg?: number,
 * }} [opts]
 */
export function getEntityFovConeDegrees(world, entityId, opts = {}) {
  if (world?.[FOV_CONE_DISABLED_KEY]) return 360;
  const id = Number(entityId || 0) | 0;
  if (id > 0) {
    const brain = world.get(id, Brain);
    const override = Number(brain?.fovConeDegrees);
    if (Number.isFinite(override) && override > 0) return clamp(override, 0, 360);
  }
  return getEntityFacingConeDegrees(world, id, opts);
}

/**
 * Canonical facing turn-cost read path.
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
export function isFacingTurnCostEnabled(world) {
  for (const [, rules] of world.query(FacingRules)) {
    return rules?.turnCostEnabled === true;
  }
  return false;
}

/**
 * Canonical facing turn-cost write path.
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {boolean} enabled
 */
export function setFacingTurnCostEnabled(world, enabled) {
  const value = enabled === true;
  /** @type {number[]} */
  const ids = [];
  for (const [id] of world.query(FacingRules)) ids.push(id);
  if (ids.length === 0) {
    const created = world.create();
    world.add(created, FacingRules, { turnCostEnabled: value });
    return created;
  }
  const firstId = ids[0];
  const firstRules = world.get(firstId, FacingRules);
  if (!firstRules || firstRules.turnCostEnabled !== value) {
    world.set(firstId, FacingRules, { turnCostEnabled: value });
  }
  for (let i = 1; i < ids.length; i++) {
    world.remove(ids[i], FacingRules);
  }
  return firstId;
}

/**
 * @param {number} fromX
 * @param {number} fromY
 * @param {number} toX
 * @param {number} toY
 * @param {number} facingDx
 * @param {number} facingDy
 * @param {number} coneDegrees
 */
export function isPointInFacingCone(fromX, fromY, toX, toY, facingDx, facingDy, coneDegrees) {
  const f = normalizeFacingVector(facingDx, facingDy);
  if (!f) return true;

  const dx = (Number(toX) | 0) - (Number(fromX) | 0);
  const dy = (Number(toY) | 0) - (Number(fromY) | 0);
  if (dx === 0 && dy === 0) return true;

  const cone = clamp(Number(coneDegrees || 0), 0, 360);
  if (cone >= 360) return true;
  if (cone <= 0) return false;

  const targetLen = Math.hypot(dx, dy);
  if (!(targetLen > 0)) return true;

  const facingLen = Math.hypot(f.dx, f.dy);
  const dot = ((f.dx / facingLen) * (dx / targetLen)) + ((f.dy / facingLen) * (dy / targetLen));
  const halfConeRad = (cone * Math.PI / 180) * 0.5;
  const cosHalf = Math.cos(halfConeRad);
  return dot >= (cosHalf - 1e-9);
}
