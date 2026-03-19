// rules/environment/dungeon/floorMemory.js
// Shared explored-floor cache and memory-degradation utility.
// Kept in its own module to break the circular-import chain:
//   legacyAffixDispatch → transition → index → populate → itemFactory

import { degradeExplored } from './exploredMap.js';

/** @type {Map<number, Map<string, Uint8Array>>} explored snapshots keyed by depth */
export const _exploredCache = new Map();

/**
 * Degrade the player's memory of one randomly-chosen floor by clearing a
 * fraction of its explored tiles.  Used by monster confusion/amnesia hooks.
 *
 * @param {() => number} rngFn   Random function that returns [0, 1)
 * @param {{fraction?: number}} [opts]
 * @returns {{depth: number, fraction: number}} which floor was hit
 */
export function degradeFloorMemory(rngFn, opts = {}) {
  const fraction = Math.max(0, Math.min(1, opts.fraction ?? 0.3));

  // Candidates: every cached depth + 0 as sentinel for "current floor"
  const candidates = [..._exploredCache.keys(), 0];
  const pick = candidates[Math.floor(rngFn() * candidates.length)];

  if (pick === 0) {
    // Degrade the live explored map (current floor)
    degradeExplored(fraction, rngFn);
    return { depth: 0, fraction };
  }

  // Degrade a cached floor's snapshot in place
  const snap = _exploredCache.get(pick);
  if (snap) {
    for (const chunk of snap.values()) {
      for (let i = 0; i < chunk.length; i++) {
        if (chunk[i] && rngFn() < fraction) {
          chunk[i] = 0;
        }
      }
    }
  }
  return { depth: pick, fraction };
}
