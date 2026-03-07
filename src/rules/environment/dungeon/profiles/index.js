// rules/environment/dungeon/profiles/index.js
// Profile registry and selection logic.
// _pickTheme moved here from floorPlan.js — floorPlan now reads profile.theme.

import { DEFAULT_PROFILE } from './default.js';
import { CATACOMB_PROFILE } from './catacombs.js';
import { ARENA_PROFILE } from './arenas.js';
import { CAVE_PROFILE } from './caves.js';

export { DEFAULT_PROFILE } from './default.js';
export { CATACOMB_PROFILE } from './catacombs.js';
export { ARENA_PROFILE } from './arenas.js';
export { CAVE_PROFILE } from './caves.js';

/**
 * Pick a dungeon profile for the given depth.
 * Consumes RNG to choose the type and, for the default profile, the visual theme.
 * @param {Object} rng - createRng() instance
 * @param {number} depth
 * @returns {import('./default.js').DungeonProfile}
 */
export function pickProfile(rng, depth) {
  const type = _pickType(rng, depth);
  if (type === 'catacombs') return CATACOMB_PROFILE;
  if (type === 'arenas')    return ARENA_PROFILE;
  if (type === 'caves')     return CAVE_PROFILE;
  // default: resolve theme by depth
  return { ...DEFAULT_PROFILE, theme: _pickTheme(rng, depth) };
}

function _pickType(rng, depth) {
  if (depth <= 3) return rng.next() < 0.7 ? 'catacombs' : 'default';
  if (depth <= 8) {
    const r = rng.next();
    if (r < 0.30) return 'caves';
    if (r < 0.60) return 'catacombs';
    return 'default';
  }
  // depth 9+: grottos added in slice 4
  const r = rng.next();
  if (r < 0.35) return 'caves';
  if (r < 0.55) return 'arenas';
  if (r < 0.70) return 'catacombs';
  return 'default';
}

function _pickTheme(rng, depth) {
  if (depth <= 3)  return 'crypt';
  if (depth <= 8)  return rng.choice(['crypt', 'cave', 'sewer']);
  if (depth <= 15) return rng.choice(['cave', 'mine', 'temple']);
  return rng.choice(['abyss', 'temple', 'mine', 'hell']);
}
