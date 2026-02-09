// rules/systems/spatialIndexSystem.js
// Keeps the spatial index in sync with Position changes.

import { updateSpatialIndex } from '../utils/spatialIndex.js';

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function spatialIndexSystem(world) {
  updateSpatialIndex(world);
}
