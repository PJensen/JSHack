// shared/utils/characterNames.js
// Starter character name utilities used by presentation/UI flows.

export const STARTER_CHARACTER_NAMES = Object.freeze([
  'Ash',
  'Rook',
  'Nyx',
  'Vale',
  'Kestrel',
  'Bram',
  'Mara',
  'Orin',
  'Lyra',
  'Dax',
  'Sable',
  'Vera',
  'Sraxx'
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
