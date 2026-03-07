// rules/environment/dungeon/profiles/arenas.js
// Arena profile: large open chambers, few rooms per chunk, no doors, lava hazards.

import { DEFAULT_PROFILE } from './default.js';

/** @type {import('./default.js').DungeonProfile} */
export const ARENA_PROFILE = {
  ...DEFAULT_PROFILE,
  id:            'arenas',
  theme:         'abyss',
  bspMaxDepth:   3,       // fewer splits → fewer, larger partitions
  minLeafSize:   8,       // large enough for big rooms
  minRoomSize:   6,
  maxRoomSize:   12,      // wide open chambers
  roomMargin:    1,
  splitRatioMin: 0.35,    // uneven splits → varied chamber sizes
  splitRatioMax: 0.65,
  corridorWidth: 2,       // wide connecting passages
  doorChance:    0.0,     // no doors — open combat flow
  hazardBias:    'lava',
  featurePool:   ['statue', 'altar', 'chest'],
};
