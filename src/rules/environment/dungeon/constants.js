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

// Dungeon hazard tiles
export const TILE_PIT            = 22; // open pit     🕳  — walkable (triggers fall), transparent, NOT flyable

// Overworld biome tiles — expanded diversity
export const TILE_BEACH          = 23; // sandy shore  ░  — walkable, transition to water
export const TILE_MARSH          = 24; // wet grassy   ≈  — walkable, high moisture
export const TILE_SWAMP          = 25; // boggy water  ≈  — walkable, thick vegetation
export const TILE_BOG            = 26; // peat bog     ≈  — walkable, very wet
export const TILE_SAND_DUNES     = 27; // sandy desert ◊  — walkable, arid
export const TILE_MUD            = 28; // mudflats     ▓  — walkable, coastal mud
export const TILE_TIDAL_FLAT     = 29; // tidal zone   ░  — walkable, exposed
export const TILE_ROCKY_SHORE    = 30; // rocky beach  •  — walkable, rough rocks
export const TILE_KELP_FOREST    = 31; // kelp beds    ≋  — water variant, underwater vegetation
export const TILE_SALT_MARSH     = 32; // salt grass   ▒  — walkable, coastal wetland
export const TILE_SHINGLE        = 33; // pebble shore ◌  — walkable, coastal pebbles
export const TILE_SEAGRASS       = 34; // seagrass     ≈  — water variant, shallow plants
export const TILE_MOORLAND       = 35; // open moor    ¨  — walkable, sparse vegetation
export const TILE_SCRUBLAND      = 36; // scrub brush  ≈  — walkable, shrubby dry
export const TILE_BADLANDS       = 37; // eroded clay  ≈  — walkable, colorful clay
export const TILE_GRAVEL         = 38; // gravel plain ▫  — walkable, rocky ground
export const TILE_PINE_FOREST    = 39; // pine forest  🌲  — walkable, dense conifers
export const TILE_PALM_FOREST    = 40; // palm forest  🌴  — walkable, tropical
export const TILE_MANGROVE       = 41; // mangrove     ≈  — walkable, coastal forest
export const TILE_CORAL_REEF     = 42; // coral        ◇  — water variant, colorful shallow

// BSP partition parameters
export const MIN_LEAF_SIZE   = 5;   // smallest BSP leaf dimension
export const MIN_ROOM_SIZE   = 3;   // smallest room interior (excl. walls)
export const MAX_ROOM_SIZE   = 7;   // largest room interior (excl. walls)
export const ROOM_MARGIN     = 1;   // gap between room edge and leaf edge (>=1 prevents room merging)
export const SPLIT_RATIO_MIN = 0.40;
export const SPLIT_RATIO_MAX = 0.60;
export const BSP_MAX_DEPTH   = 5;

export const AVG_ROOM_SIZE = (MIN_ROOM_SIZE + MAX_ROOM_SIZE) / 2;
