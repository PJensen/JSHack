// Shared hunger combat severity levels used by stat/combat systems.
// Kept dependency-free so low-level stat resolvers can import without
// pulling broader food/callback modules.

export const HUNGER_COMBAT_LEVELS = Object.freeze([
  "hungry",
  "famished",
  "starving",
  "wasting",
]);
