// rules/environment/dungeon/profiles/catacombs.js
// Catacomb profile: maze of tight tomb cells, near-even BSP splits, many doors.

import { DEFAULT_PROFILE } from './default.js';

/** @type {import('./default.js').DungeonProfile} */
export const CATACOMB_PROFILE = {
  ...DEFAULT_PROFILE,
  id:            'catacombs',
  theme:         'crypt',
  bspMaxDepth:   7,       // more splits → more, smaller cells
  minLeafSize:   4,       // allow tighter partitions
  minRoomSize:   3,
  maxRoomSize:   4,       // tomb-sized cells
  roomMargin:    0,       // cells butt against partition walls
  splitRatioMin: 0.45,    // near-even splits → grid regularity
  splitRatioMax: 0.55,
  corridorWidth: 1,
  doorChance:    0.9,     // near-every doorway gets a door
  monsterFilter: def => (def.tags ?? []).some(t => ['undead', 'skeletal', 'spectral', 'humanoid'].includes(t)),
};
