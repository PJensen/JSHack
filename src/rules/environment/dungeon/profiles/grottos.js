// rules/environment/dungeon/profiles/grottos.js
// Grotto profile: vast open underground spaces, seamlessly tiled via fBM noise.

import { DEFAULT_PROFILE } from './default.js';
import { noiseGenerator } from '../generators/noise.js';

/** @type {import('./default.js').DungeonProfile} */
export const GROTTO_PROFILE = {
  ...DEFAULT_PROFILE,
  id:          'grottos',
  theme:       'cave',
  generator:   noiseGenerator,  // bypasses BSP; returns { tiles, rooms }
  doorChance:  0.0,             // no doorways in open cave spaces
  hazardBias:  'water',
  monsterFilter: def => (def.tags ?? []).some(t => ['beast', 'vermin', 'giant'].includes(t)),
  hallwayMonsterCap: 6,
};
