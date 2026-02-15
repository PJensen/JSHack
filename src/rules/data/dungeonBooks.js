// rules/data/dungeonBooks.js
// Decorative books scattered throughout the dungeon.
// Each has a title and flavor text shown when the player bumps into them.

export const DUNGEON_BOOKS = [
  {
    title: "On the Care of Dungeon Cats",
    text: "Your kitty will follow you, fetch items, and flee when injured. It will also drop things at your feet unprompted. Do not question why. This is simply what cats do.",
  },
  {
    title: "Snake Nest Husbandry",
    text: "The snake trap releases a cluster of serpents when triggered. Venomous fangs, 25% poison chance. They appear from nowhere. Do not ask where they were hiding.",
  },
  {
    title: "The Spike Trap Quarterly, Vol. III",
    text: "This season's models deliver a clean 35% of max HP in damage. Reader question: 'Can adventurers see them?' Editor's response: 'Not until it's too late.'",
  },
  {
    title: "Touchstone: A Gemcutter's Manual",
    text: "Rub the stone across the touchstone. A hard white streak means value. A dull scratch means you've been carrying glass through fifteen floors of dungeon.",
  },
  {
    title: "On Eating Monster Corpses",
    text: "Rat corpse: disease. Snake corpse: poison. Spider corpse: also poison. Floating eye corpse: you forget who you are. There is a pattern here. Please notice it.",
  },
  {
    title: "A Field Guide to Grid Bugs",
    text: "The grid bug moves only along cardinal axes. Nobody knows why. One theory suggests they are bound by an ancient curse. Another theory: they are just very stubborn.",
  },
];

/**
 * Pick a random book entry for a given RNG.
 * @param {Object} rng - Seeded RNG with .int(min, max)
 * @returns {{ title: string, text: string }}
 */
export function pickDungeonBook(rng) {
  return DUNGEON_BOOKS[rng.int(0, DUNGEON_BOOKS.length - 1)];
}
