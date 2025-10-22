// Constants and configuration
// Keep values small and documented to maintain determinism across runs.

// RNG: default seed used when none provided. Use a numeric seed for mulberry32.
export const DEFAULT_SEED = 0xC0FFEE; // integer seed (0..2^32-1)

// Grid and rendering constants
export const COLS = 80; // number of cells horizontally
export const ROWS = 48; // number of cells vertically
export const CELL_W = 8; // cell width in CSS pixels (render scale)
export const CELL_H = 8; // cell height in CSS pixels

// Base canvas pixel size; renderer may scale to devicePixelRatio.
export const BASE_W = COLS * CELL_W;
export const BASE_H = ROWS * CELL_H;

// Field of view radius (in cells) used by FOV algorithm
export const FOV_RADIUS = 10; // typical range: 6..16

// Map generation / dungeon params
export const ROOM_MAX = 8; // maximum number of rooms
export const ROOM_MIN = 4; // minimum number of rooms
export const ROOM_MAX_SIZE = 12; // max room width/height in cells
export const ROOM_MIN_SIZE = 4; // min room width/height in cells

// Game tick rate (simulation steps per second)
export const TICKS_PER_SECOND = 20; // use fixed-step loop (20 TPS common)

// Export a small config object for convenience
export const CONFIG = {
  seed: DEFAULT_SEED,
  cols: COLS,
  rows: ROWS,
  cellW: CELL_W,
  cellH: CELL_H,
  baseW: BASE_W,
  baseH: BASE_H,
  fovRadius: FOV_RADIUS,
  roomMax: ROOM_MAX,
  roomMin: ROOM_MIN,
  roomMaxSize: ROOM_MAX_SIZE,
  roomMinSize: ROOM_MIN_SIZE,
  ticksPerSecond: TICKS_PER_SECOND,
};
