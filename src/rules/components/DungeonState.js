import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Singleton component on the dungeon manager entity.
 * Tracks current floor depth and entity ownership for bulk cleanup.
 */
export const DungeonState = defineComponent('DungeonState', {
  worldSeed: 0,
  currentDepth: 1,
  floorEntityIds: [], // all entity IDs created for this floor
});
