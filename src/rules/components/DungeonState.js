import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Singleton component on the dungeon manager entity.
 * Tracks current floor depth and chunk loading state.
 */
export const DungeonState = defineComponent('DungeonState', {
  worldSeed: 0,
  currentDepth: 1,
  playerChunkX: 0,
  playerChunkY: 0,
  chunkLoadRadius: 2,
  chunkLoadBudget: 2, // max chunks to generate per tick
});
