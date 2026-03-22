// rules/environment/dungeon/profiles/index.js
// Profile registry and selection logic.
// _pickTheme moved here from floorPlan.js — floorPlan now reads profile.theme.

import { DEFAULT_PROFILE } from './default.js';
import { CATACOMB_PROFILE } from './catacombs.js';
import { ARENA_PROFILE } from './arenas.js';
import { CAVE_PROFILE } from './caves.js';
import { GROTTO_PROFILE } from './grottos.js';

export { DEFAULT_PROFILE } from './default.js';
export { CATACOMB_PROFILE } from './catacombs.js';
export { ARENA_PROFILE } from './arenas.js';
export { CAVE_PROFILE } from './caves.js';
export { GROTTO_PROFILE } from './grottos.js';

/**
 * Pick a dungeon profile for the given depth.
 * Consumes RNG to choose the type and, for the default profile, the visual theme.
 * @param {Object} rng - createRng() instance
 * @param {number} depth
 * @param {string|null} [typeOverride] - force a specific profile type (e.g. from ?dungeonType)
 * @returns {import('./default.js').DungeonProfile}
 */
export function pickProfile(rng, depth, typeOverride = null) {
  // Always consume the type RNG roll to keep downstream sequence stable.
  const picked = _pickType(rng, depth);
  const type = typeOverride || picked;
  if (type === 'catacombs') return CATACOMB_PROFILE;
  if (type === 'arenas')    return ARENA_PROFILE;
  if (type === 'caves')     return CAVE_PROFILE;
  if (type === 'grottos')   return GROTTO_PROFILE;
  // default: resolve theme by depth
  return { ...DEFAULT_PROFILE, theme: _pickTheme(rng, depth) };
}

function _pickType(rng, depth) {
  if (depth === 1) return 'default'; // special: depth 1 is always default (perlin noise)
  if (depth === 2) return 'default'; // special: depth 2 is always default
  if (depth <= 3) return rng.next() < 0.7 ? 'catacombs' : 'default';
  if (depth <= 8) {
    const r = rng.next();
    if (r < 0.30) return 'caves';
    if (r < 0.60) return 'catacombs';
    return 'default';
  }
  if (depth <= 15) {
    // caves 35 %, grottos 30 %, arenas 20 %, default 15 %
    const r = rng.next();
    if (r < 0.35) return 'caves';
    if (r < 0.65) return 'grottos';
    if (r < 0.85) return 'arenas';
    return 'default';
  }
  // depth 16+: grottos 35 %, arenas 35 %, caves 30 %
  const r = rng.next();
  if (r < 0.35) return 'grottos';
  if (r < 0.70) return 'arenas';
  return 'caves';
}

function _pickTheme(rng, depth) {
  if (depth <= 3)  return 'crypt';
  if (depth <= 8)  return rng.choice(['crypt', 'cave', 'sewer']);
  if (depth <= 15) return rng.choice(['cave', 'mine', 'temple']);
  return rng.choice(['abyss', 'temple', 'mine', 'hell']);
}
