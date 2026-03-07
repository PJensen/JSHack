// rules/environment/dungeon/generators/cellular.js
// Post-process passes that mutate a tile array in place.
// All functions match the postProcess signature: (tiles, rng, CHUNK_SIZE) => void.
// CHUNK_SIZE is passed rather than imported so these functions are self-contained.

const TILE_WALL  = 2;
const TILE_FLOOR = 1;

/**
 * Corner erosion: softens BSP geometry into organic cave shapes.
 *
 * Rule: if a TILE_WALL has >= 3 orthogonal TILE_FLOOR neighbours, convert it
 * to TILE_FLOOR.  Runs 2 passes over a per-pass snapshot so within-pass
 * cascading does not occur.
 *
 * Safe invariant: only WALL→FLOOR transitions happen.  No floor tile is ever
 * removed, so BSP connectivity is strictly preserved.
 *
 * @param {Uint8Array} tiles - CHUNK_SIZE*CHUNK_SIZE flat array (mutated in place)
 * @param {Object} _rng     - unused; present for postProcess signature consistency
 * @param {number} size     - tiles per chunk side (CHUNK_SIZE)
 */
export function cornerErosion(tiles, _rng, size) {
  for (let pass = 0; pass < 2; pass++) {
    // Snapshot: read from copy, write to tiles.
    // This prevents a conversion in one cell from influencing cells later in
    // the same pass, keeping each pass fully deterministic.
    const snap = new Uint8Array(tiles);

    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        if (snap[y * size + x] !== TILE_WALL) continue;

        const n = snap[(y - 1) * size + x] === TILE_FLOOR ? 1 : 0;
        const s = snap[(y + 1) * size + x] === TILE_FLOOR ? 1 : 0;
        const w = snap[y * size + (x - 1)] === TILE_FLOOR ? 1 : 0;
        const e = snap[y * size + (x + 1)] === TILE_FLOOR ? 1 : 0;

        if (n + s + w + e >= 3) tiles[y * size + x] = TILE_FLOOR;
      }
    }
  }
}
