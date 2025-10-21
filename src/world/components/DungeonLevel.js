import { defineComponent } from '../../lib/ecs/core.js';

// DungeonLevel component holds properties for a specific dungeon level
export const DungeonLevel = defineComponent('DungeonLevel', {
  depth: 1, // Level/floor number
  mapId: null, // Reference to map data or map entity
  upX: 0, upY: 0, // Arrival coordinates
  stairX: 0, stairY: 0, // Stairs down coordinates
  seen: null, // 2D array or reference to seen tiles
  rngSeed: null, // Seed for deterministic RNG
  loggedFeatures: null, // Set or array of discovered features
  effects: null // Array of transient effects
});
