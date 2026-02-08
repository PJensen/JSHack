// rules/environment/dungeon/constants.js
// Shared constants for the chunk-based BSP dungeon generator.

/** Tiles per chunk side (power of 2 for fast bitshift division). */
export const CHUNK_SIZE = 32;

// Tile type enum (stored in Uint8Array per chunk)
export const TILE_VOID       = 0;
export const TILE_FLOOR      = 1;
export const TILE_WALL       = 2;
export const TILE_DOOR       = 3;
export const TILE_STAIR_DOWN = 4;
export const TILE_STAIR_UP   = 5;

// BSP partition parameters
export const MIN_LEAF_SIZE   = 7;   // smallest BSP leaf dimension
export const MIN_ROOM_SIZE   = 4;   // smallest room interior (excl. walls)
export const ROOM_MARGIN     = 1;   // gap between room edge and leaf edge
export const SPLIT_RATIO_MIN = 0.35;
export const SPLIT_RATIO_MAX = 0.65;
export const BSP_MAX_DEPTH   = 5;

// Chunk management
export const CHUNK_LOAD_RADIUS   = 2;  // Manhattan distance in chunks
export const CHUNK_UNLOAD_RADIUS = 3;  // unload beyond this
