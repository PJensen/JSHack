// rules/environment/dungeon/profiles/caves.js
// Cave profile: organic natural caverns.
// BSP skeleton with large, loose rooms + cornerErosion post-process.

import { DEFAULT_PROFILE } from './default.js';
import { cornerErosion } from '../generators/cellular.js';

/** @type {import('./default.js').DungeonProfile} */
export const CAVE_PROFILE = {
  ...DEFAULT_PROFILE,
  id:            'caves',
  theme:         'cave',
  bspMaxDepth:   3,       // fewer splits → fewer, larger partitions
  minLeafSize:   8,       // large partitions for wide rooms
  minRoomSize:   5,
  maxRoomSize:   11,      // big rooms that erode into cave blobs
  roomMargin:    0,       // rooms can fill the leaf — merges after erosion
  splitRatioMin: 0.30,    // very uneven splits → irregular cavern sizes
  splitRatioMax: 0.70,
  corridorWidth: 2,       // wide corridors that erode further
  doorChance:    0.0,     // no doors in a cave
  postProcess:   cornerErosion,
  hazardBias:    'water',
  monsterFilter: def => (def.tags ?? []).some(t => ['beast', 'vermin', 'giant'].includes(t)),
};
