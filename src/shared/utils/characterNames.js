// shared/utils/characterNames.js
// Starter character name utilities used by presentation/UI flows.

export const STARTER_CHARACTER_NAMES = Object.freeze([
  'Ash',
  'Rook',
  'Nyx',
  'Vale',
  'Bram',
  'Mara',
  'Orin',
  'Lyra',
  'Dax',
  'Sable',
  'Vera',
  'Sraxx',
  'Grim',
  'Thane',
  'Wren',
  'Kael',
  'Ember',
  'Flint',
  'Jett',
  'Pike',
  'Rune',
  'Thorn',
  'Shade',
  'Crag',
  'Vex',
  'Moss',
  'Blight',
  'Fenn',
  'Dirk',
  'Hex',
  'Zara',
  'Brynn',
  'Fen',
  'Garth',
  'Helga',
  'Bjorn',
  'Sigrid',
  'Gnarl',
]);

/** @returns {number} */
export function randomUnitFloat() {
  const c = globalThis?.crypto;
  if (c && typeof c.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    c.getRandomValues(buf);
    return buf[0] / 0x100000000;
  }
  return Math.random();
}

/**
 * @param {() => number} [nextFloat]
 * @returns {string}
 */
export function pickRandomCharacterName(nextFloat = randomUnitFloat) {
  const names = STARTER_CHARACTER_NAMES;
  if (!Array.isArray(names) || names.length === 0) return 'Hero';
  const roll = Number(nextFloat());
  if (!Number.isFinite(roll)) return names[0];
  const i = Math.max(0, Math.min(names.length - 1, Math.floor(roll * names.length)));
  return names[i];
}
