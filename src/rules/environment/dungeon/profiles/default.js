// rules/environment/dungeon/profiles/default.js
// Default dungeon profile — mirrors the original hard-coded BSP constants.
// All other profiles spread this and override fields they care about.

/**
 * @typedef {Object} DungeonProfile
 * @property {string}        id
 * @property {string|null}   theme          - display-layer theme; null = resolved by pickProfile
 * @property {Function|null} generator      - null = BSP pipeline; fn(seed,cx,cy,CHUNK_SIZE)=>Uint8Array
 * @property {number}        bspMaxDepth    - max BSP recursion depth
 * @property {number}        minLeafSize    - smallest allowed BSP leaf dimension
 * @property {number}        minRoomSize    - smallest room interior (excl. walls)
 * @property {number}        maxRoomSize    - largest room interior (excl. walls)
 * @property {number}        roomMargin     - gap between room edge and leaf boundary
 * @property {number}        splitRatioMin  - BSP split position lower bound (0–1)
 * @property {number}        splitRatioMax  - BSP split position upper bound (0–1)
 * @property {number|null}   roomSparsity   - null = use dungeonConfig.roomSparsity; 0–1 omits more leaf rooms
 * @property {number}        corridorWidth  - corridor tile width (1 = single, 2 = wide)
 * @property {number}        doorChance     - probability a valid doorway becomes a door (0–1)
 * @property {Function|null} postProcess    - fn(tiles, rng, CHUNK_SIZE) mutates in place; called after BSP/generator, before edge gates
 * @property {string|null}   hazardBias     - null | 'water' | 'lava' | 'ice'
 * @property {Function|null} monsterFilter  - fn(monsterDef)=>bool to restrict monster pool
 * @property {string[]|null} featurePool    - override room feature kinds; null = default pool
 * @property {number}        doorFeatureRate - fraction of non-entry rooms that get a central feature
 * @property {number}        shopChance     - probability a dead-end room becomes a shop
 * @property {number}        hallwayMonsterCap - max hallway (corridor) monsters per chunk
 */

/** @type {DungeonProfile} */
export const DEFAULT_PROFILE = {
  id:             'default',
  theme:          null,   // resolved to a concrete string by pickProfile
  generator:      null,
  bspMaxDepth:    5,
  minLeafSize:    5,
  minRoomSize:    3,
  maxRoomSize:    7,
  roomMargin:     1,
  splitRatioMin:  0.40,
  splitRatioMax:  0.60,
  roomSparsity:   null,
  corridorWidth:  1,
  doorChance:     0.6,
  postProcess:    null,
  hazardBias:     null,
  monsterFilter:  null,
  featurePool:    null,
  doorFeatureRate: 0.5,
  shopChance:     0.3,
  hallwayMonsterCap: 3,
};
