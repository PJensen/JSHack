// rules/environment/dungeon/dungeonConfig.js
// Mutable tuning knobs for dungeon generation.
// Edit here or override at runtime via URL params (e.g. ?dungeonScale=0.3).

export const dungeonConfig = {
  /** Scale factor for dungeon size. 1.0 = default, 0.3 = compact, 2.0 = huge. */
  dungeonScale: 0.3,
  /** Min/max number of down-stairs generated per floor (inclusive). Tune after playtesting. */
  minDownStairs: 2,
  maxDownStairs: 3,
};
