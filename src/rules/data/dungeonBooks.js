// rules/data/dungeonBooks.js
// Catalog IDs for decorative dungeon books (definitions live in itemCatalog.js).

const DUNGEON_BOOK_IDS = [
  "book_kitty",
  "book_snakes",
  "book_spikes",
  "book_touchstone",
  "book_corpses",
  "book_gridbugs",
];

/**
 * Pick a random decorative book catalog ID.
 * @param {Object} rng - Seeded RNG with .int(min, max)
 * @returns {{ id: string }}
 */
export function pickDungeonBook(rng) {
  const id = DUNGEON_BOOK_IDS[rng.int(0, DUNGEON_BOOK_IDS.length - 1)];
  return { id };
}
