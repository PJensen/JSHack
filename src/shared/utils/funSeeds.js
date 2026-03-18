// shared/utils/funSeeds.js
// Fun hex seeds that spell words — picked at random for new games.

import { randomUnitFloat } from './characterNames.js';

export const FUN_SEEDS = Object.freeze([
  0xC0FFEE,    // COFFEE
  0xDEADBEEF,  // DEADBEEF
  0xBAADF00D,  // BAADFOOD
  0xCAFEBABE,  // CAFEBABE
  0xFEEDFACE,  // FEEDFACE
  0xDEFACED,   // DEFACED
  0xBADCAFE,   // BADCAFE
  0xBEEFCAFE,  // BEEFCAFE
  0xDECAFBAD,  // DECAFBAD
  0xBADDEED,   // BADDEED
  0xFADEDACE,  // FADEDACE
  0xDABBAD00,  // DABBADOO
  0xB0BAFE77,  // BOBAFETT
  0x1CEDC0DE,  // ICEDCODE
  0xDEFEA7ED,  // DEFEATED
  0xADD1C7ED,  // ADDICTED
  0xD15C0BAD,  // DISCOBAD
  0xACEDBACE,  // ACEDBACE
  0xFACEFEED,  // FACEFEED
  0xC0DED00D,  // CODEDOOD
]);

/** @param {() => number} [nextFloat] */
export function pickRandomSeed(nextFloat = randomUnitFloat) {
  const seeds = FUN_SEEDS;
  const roll = Number(nextFloat());
  if (!Number.isFinite(roll)) return seeds[0];
  const i = Math.max(0, Math.min(seeds.length - 1, Math.floor(roll * seeds.length)));
  return seeds[i];
}
