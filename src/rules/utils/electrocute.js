// src/rules/utils/electrocute.js
// Canonical sensory-overload effect for any lightning/electric hit.
//
// All shock/lightning sources (weather strikes, shock traps, deity wrath, spells)
// MUST call applyElectrocuted() instead of hand-rolling stun + blind + deafen.
// This ensures tuning is done in one place (CANNON rule).
//
// Effect profile (all values recoverable — no permanent damage):
//   Stun:      2 turns
//   Blindness: instant, hold 2 turns, recover over 4 turns
//   Deafness:  instant, full impairment, hold 2 turns, recover over 6 turns
//
// Optional shock DoT (follow-on jolt) is driven by the caller's potency
// since it depends on the entity's max HP.

import { ActiveEffects } from '../components/ActiveEffects.js';
import { blind } from './blind.js';
import { deafen } from './deafen.js';

/**
 * Apply the canonical electrocuted sensory-overload bundle to a target entity.
 *
 * Applies:
 *  - 2-turn stun
 *  - Instant blindness (vision → 1, hold 2 turns, recover over 4 turns)
 *  - Instant full deafness (hold 2 turns, recover over 6 turns)
 *
 * Returns false if the target is invalid or has no ActiveEffects component and
 * one could not be created (safe to ignore for non-player entities).
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} targetId
 * @returns {boolean}
 */
export function applyElectrocuted(world, targetId) {
  const id = Number(targetId || 0) | 0;
  if (!(id > 0)) return false;
  if (!world.isAlive?.(id)) return false;

  // Ensure ActiveEffects exists
  let ae = world.get(id, ActiveEffects);
  if (!ae) {
    try { world.add(id, ActiveEffects, { effects: [] }); } catch { /* already exists */ }
    ae = world.get(id, ActiveEffects);
  }
  if (!ae || !Array.isArray(ae.effects)) return false;

  // 2-turn stun (extend if already stunned)
  const existingStun = ae.effects.find((e) => e.key === 'stun');
  if (existingStun) {
    existingStun.turnsLeft = Math.max(existingStun.turnsLeft, 2);
  } else {
    ae.effects.push({ key: 'stun', turnsLeft: 2, potency: 1, stacks: 1 });
  }

  // Instant blindness: vision collapses to 1, holds 2 turns, recovers over 4 turns
  blind(world, id, 1, 0, 2, 4);

  // Instant deafness: full impairment, holds 2 turns, recovers over 6 turns
  deafen(world, id, 1.0, 0, 2, 6);

  return true;
}
