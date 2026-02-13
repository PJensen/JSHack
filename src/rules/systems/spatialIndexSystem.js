// rules/systems/spatialIndexSystem.js
// Keeps the spatial index in sync with Position changes.

import { updateSpatialIndex } from '../utils/spatialIndex.js';

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function spatialIndexSystem(world) {
  updateSpatialIndex(world);
  // ecs-js defers structural mutations during tick; run a second pass after
  // flush so newly spawned stationary entities (like corpses) are indexed.
  world.command(() => updateSpatialIndex(world));
}
