// rules/environment/dungeon/constants.js
// Shared constants for the chunk-based BSP dungeon generator.

/** Tiles per chunk side. */
export const CHUNK_SIZE = 24;

// Tile type enum (stored in Uint8Array per chunk)
export const TILE_VOID       = 0;
export const TILE_FLOOR      = 1;
export const TILE_WALL       = 2;
export const TILE_DOOR       = 3;
export const TILE_STAIR_DOWN = 4;
export const TILE_STAIR_UP   = 5;
export const TILE_GRASS      = 6;
export const TILE_WATER      = 7;
export const TILE_MOUNTAIN   = 8;
export const TILE_TREE       = 9;

// Overworld terrain variants (visual only — all grass variants walkable, mountain variants opaque)
export const TILE_GRASS_A      = 10; // sparse/bare  '
export const TILE_GRASS_C      = 11; // medium-dense ;
export const TILE_GRASS_D      = 12; // thick/lush   `
export const TILE_MOUNTAIN_B   = 13; // mid-peak     ∧
export const TILE_MOUNTAIN_C   = 14; // high-peak    ▲
export const TILE_WATER_DEEP   = 15; // open water   ≈

// Hazard / special terrain tiles
export const TILE_ICE            = 16; // slippery ice — instant chain slide
export const TILE_SHALLOW_WATER  = 17; // shallow pool — extinguishes burn
export const TILE_LAVA           = 18; // molten rock  — scorches on step

// Overworld structure tiles
export const TILE_FARMLAND       = 19; // tilled soil  ░  — walkable, transparent
export const TILE_FENCE          = 20; // wooden fence #  — NOT walkable, transparent, flyable
export const TILE_COBBLESTONE    = 21; // grey stone cobble ·  — walkable, transparent

// BSP partition parameters
export const MIN_LEAF_SIZE   = 5;   // smallest BSP leaf dimension
export const MIN_ROOM_SIZE   = 3;   // smallest room interior (excl. walls)
export const MAX_ROOM_SIZE   = 7;   // largest room interior (excl. walls)
export const ROOM_MARGIN     = 1;   // gap between room edge and leaf edge (>=1 prevents room merging)
export const SPLIT_RATIO_MIN = 0.40;
export const SPLIT_RATIO_MAX = 0.60;
export const BSP_MAX_DEPTH   = 5;
