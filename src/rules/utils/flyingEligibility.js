// rules/utils/flyingEligibility.js
// Checks whether flying is allowed on the current floor.

import { DungeonState } from '../components/DungeonState.js';
import { Flying } from '../components/Flying.js';

/** Profile types that permit flight (open / high-ceiling spaces). */
const FLYABLE_PROFILES = new Set(['overworld', 'caves', 'grottos']);
const ALWAYS_FLY_SIZE_CLASSES = new Set(['XS']);

/**
 * Returns true if the current floor allows flight.
 * Flying is permitted on the overworld (depth 0) and in cavern-type levels
 * (caves, grottos) that have high ceilings.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @returns {boolean}
 */
export function canFlyOnFloor(world) {
  for (const [, ds] of world.query(DungeonState)) {
    if (ds.currentDepth === 0) return true;
    return FLYABLE_PROFILES.has(ds.profileType);
  }
  return false;
}

/**
 * Canonical per-monster flight eligibility.
 * Small flyers (derived from size class) are always allowed to fly.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {{ sizeClass?: string }|null|undefined} monsterDef
 * @returns {boolean}
 */
export function canMonsterFlyOnFloor(world, monsterDef) {
  const sizeClass = String(monsterDef?.sizeClass || '').toUpperCase();
  if (ALWAYS_FLY_SIZE_CLASSES.has(sizeClass)) return true;
  return canFlyOnFloor(world);
}

/**
 * Returns true when the current floor is the open-air overworld.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @returns {boolean}
 */
export function isOverworldFloor(world) {
  for (const [, ds] of world.query(DungeonState)) {
    return ds.currentDepth === 0 || ds.profileType === 'overworld';
  }
  return false;
}

/**
 * In the overworld, airborne creatures get near-guaranteed sight lines:
 * range still matters, but terrain occluders do not.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {{
 *   sourceId?: number,
 *   targetId?: number,
 *   sourcePos: { x:number, y:number },
 *   targetPos: { x:number, y:number },
 *   range: number,
 * }} spec
 * @returns {boolean}
 */
export function hasOverworldAerialLOS(world, spec) {
  if (!isOverworldFloor(world)) return false;
  const sourceId = spec?.sourceId || 0;
  const targetId = spec?.targetId || 0;
  if (!sourceId && !targetId) return false;
  if (!world.has(sourceId, Flying) && !world.has(targetId, Flying)) return false;

  const sourcePos = spec?.sourcePos;
  const targetPos = spec?.targetPos;
  if (!sourcePos || !targetPos) return false;

  const range = Math.max(0, Math.trunc(Number(spec?.range) || 0));
  const dist = Math.max(
    Math.abs((sourcePos.x | 0) - (targetPos.x | 0)),
    Math.abs((sourcePos.y | 0) - (targetPos.y | 0)),
  );
  return dist <= range;
}
