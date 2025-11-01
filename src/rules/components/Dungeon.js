import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Component representing the overall dungeon state.
 * Holds data about the current dungeon level and basic fields
 */
export const Dungeon = defineComponent('Dungeon', {
  level: 1, // Dungeon level or floor number
  id: null, // Optional unique dungeon/map identifier
  name: '', // Optional dungeon name
});

/**
 * Component representing a single dungeon level.
 * Holds data about the level's state, map, and features.
 */
export const DungeonLevel = defineComponent('DungeonLevel', {
  depth: 1, // Level/floor number
  mapId: null, // Reference to map data or map entity
  seen: null, // 2D array or reference to seen tiles
  rngSeed: null, // Seed for deterministic RNG
  loggedFeatures: null, // Set or array of discovered features
  effects: null // Array of transient effects
});

/**
 * Transition link between dungeon levels.
 * Used for stairs, portals, etc.
 */
export const DungeonLevelLink = defineComponent('DungeonLevelLink', {
  sourceLevelId: null,
  destinationLevelId: null,
  destinationPosition: null, // optional { x, y }
  oneWay: false,
  autoActivate: true,
  scriptRef: null,
  traversed: 0,
  tags: []
});