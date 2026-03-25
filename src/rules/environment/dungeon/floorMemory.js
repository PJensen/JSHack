// rules/environment/dungeon/floorMemory.js
// Shared explored-floor cache and memory-degradation utility.
// Kept in its own module to break the circular-import chain:
//   legacyAffixDispatch → transition → index → populate → itemFactory

import { degradeExplored } from './exploredMap.js';
import { ExploredFloorRepository } from '../../repositories/ExploredFloorRepository.js';

/** Shared explored snapshot repository keyed by dungeon depth. */
export const exploredFloorRepository = new ExploredFloorRepository();

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
  const candidates = [...exploredFloorRepository.listDepths(), 0];
  const pick = candidates[Math.floor(rngFn() * candidates.length)];

  if (pick === 0) {
    // Degrade the live explored map (current floor)
    degradeExplored(fraction, rngFn);
    return { depth: 0, fraction };
  }

  // Degrade a cached floor's snapshot in place
  const snap = exploredFloorRepository.getSnapshot(pick);
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
