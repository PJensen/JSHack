// rules/environment/dungeon/dungeonConfig.js
// Mutable tuning knobs for dungeon generation.
// Edit here or override at runtime via URL params
// (e.g. ?dungeonScale=0.3&sparsity=0.4).

export const dungeonConfig = {
  /** Scale factor for dungeon footprint. 0.3 = compact/mobile, 1.0 = standard, 2.0 = huge. */
  dungeonScale: 0.3,
  /**
   * Fraction of BSP leaf rooms to omit during chunk generation.
   * 0 = every eligible leaf gets a room; 0.4 = noticeably airier chunks.
   */
  roomSparsity: 0.24,
  /** Min/max number of down-stairs generated per floor (inclusive). Tune after playtesting. */
  minDownStairs: 2,
  maxDownStairs: 3,
};
