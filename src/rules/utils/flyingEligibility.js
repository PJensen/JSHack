// rules/utils/flyingEligibility.js
// Checks whether flying is allowed on the current floor.

import { DungeonState } from '../components/DungeonState.js';

/** Profile types that permit flight (open / high-ceiling spaces). */
const FLYABLE_PROFILES = new Set(['overworld', 'caves', 'grottos']);

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
