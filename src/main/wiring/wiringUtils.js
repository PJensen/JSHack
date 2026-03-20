import { Position } from "../../rules/components/Position.js";
import { playerEntity } from "../../rules/utils/queries.js";
import { chebyshev } from "../../rules/utils/distance.js";

/**
 * Returns true when the player entity is within Chebyshev distance 1 of
 * the given target entity (i.e. adjacent or overlapping).
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} targetId
 * @returns {boolean}
 */
export function isPlayerAdjacentTo(world, targetId) {
  const pe = playerEntity(world);
  if (!pe || !(targetId > 0)) return false;
  const ppos = world.get(pe.id, Position);
  const tpos = world.get(targetId, Position);
  if (!ppos || !tpos) return false;
  return chebyshev(ppos, tpos) <= 1;
}
