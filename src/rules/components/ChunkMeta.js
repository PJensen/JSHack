import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Attached to a "chunk tracker" entity. One per loaded chunk.
 * Stores chunk coordinates and the IDs of all entities belonging to this chunk.
 */
export const ChunkMeta = defineComponent('ChunkMeta', {
  chunkX: 0,
  chunkY: 0,
  depth: 0,
  entityIds: [],
  generated: false,
});
