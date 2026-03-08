import { Position } from "../components/Position.js";
import { Flying } from "../components/Flying.js";
import { Vitality } from "../components/Vitality.js";
import { hasLOS } from "../../shared/math/gridLOS.js";
import { hasOverworldAerialLOS } from "./flyingEligibility.js";

/**
 * Find a living airborne entity on the specified tile.
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} x
 * @param {number} y
 * @param {{ excludeId?: number }} [options]
 * @returns {number}
 */
export function findLivingFlyingOccupantAt(world, x, y, options = {}) {
  const tx = x | 0;
  const ty = y | 0;
  const excludeId = Number(options?.excludeId || 0) | 0;

  for (const [id, pos] of world.query(Position)) {
    if (id === excludeId) continue;
    if ((pos.x | 0) !== tx || (pos.y | 0) !== ty) continue;
    if (!world.has(id, Flying)) continue;
    const vit = world.get(id, Vitality);
    if (vit && (vit.hp | 0) <= 0) continue;
    return id | 0;
  }
  return 0;
}

/**
 * Spell LOS matches normal terrain LOS, plus the overworld's aerial-visibility
 * rule when either endpoint is flying.
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {{
 *   sourceId: number,
 *   targetId?: number,
 *   sourcePos: { x:number, y:number },
 *   targetPos: { x:number, y:number },
 *   range: number,
 *   isBlocked: (x:number, y:number) => boolean,
 *   allowFlyingOccupantAtTarget?: boolean,
 * }} spec
 * @returns {boolean}
 */
export function hasSpellLineOfSight(world, spec) {
  const sourcePos = spec?.sourcePos;
  const targetPos = spec?.targetPos;
  if (!sourcePos || !targetPos || typeof spec?.isBlocked !== "function") return false;

  const range = Math.max(0, Math.trunc(Number(spec?.range) || 0));
  if (hasLOS(sourcePos.x | 0, sourcePos.y | 0, targetPos.x | 0, targetPos.y | 0, spec.isBlocked)) {
    return true;
  }

  let targetId = Number(spec?.targetId || 0) | 0;
  if (!(targetId > 0) && spec?.allowFlyingOccupantAtTarget) {
    targetId = findLivingFlyingOccupantAt(world, targetPos.x, targetPos.y, {
      excludeId: Number(spec?.sourceId || 0) | 0,
    });
  }
  if (!(targetId > 0)) return false;

  return hasOverworldAerialLOS(world, {
    sourceId: Number(spec?.sourceId || 0) | 0,
    targetId,
    sourcePos,
    targetPos,
    range,
  });
}
