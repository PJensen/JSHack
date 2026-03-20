// src/rules/utils/deafen.js
// Temporal stat envelope for hearing impairment.
// Applies a ramp-in / hold / ramp-out modifier on a hearingImpairment "stat"
// that drives effective hearing sensitivity without mutating Anatomy.hearing.
//
// Spell/effect surface:
//   deafen(world, target, toValue, rampIn, holdFor, rampOut, endValue?)
//
// The modifier is stored as a 'stat_envelope' entry with stat='hearingImpairment'
// in ActiveEffects. effectSystem.js processes it and reports 'deafened' status
// when the impairment value is above zero.
//
// hearingImpairment scale: 0 = normal hearing, 1 = completely deaf.

import { ensureActiveEffects } from './effects.js';

/**
 * Apply a temporal hearing-impairment effect to a target entity.
 * Uses a stat_envelope with stat='hearingImpairment'.
 *
 * The impairment level starts at 0 (normal), ramps to toValue at the peak,
 * holds, then recovers back to endValue (default: 0, full recovery).
 *
 * No permanent hearing damage is ever applied — endValue defaults to 0.
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} targetId
 * @param {number} toValue    peak impairment (0–1, where 1 = completely deaf)
 * @param {number} rampIn     ticks to reach peak from 0
 * @param {number} holdFor    ticks to hold at peak
 * @param {number} rampOut    ticks to recover from peak back to endValue
 * @param {number} [endValue] final impairment after recovery; defaults to 0 (full recovery)
 * @returns {boolean} false if the effect could not be applied
 */
export function deafen(world, targetId, toValue, rampIn, holdFor, rampOut, endValue = 0) {
  const id = Number(targetId || 0) | 0;
  if (!(id > 0)) return false;

  const totalTicks = (rampIn | 0) + (holdFor | 0) + (rampOut | 0);
  if (!(totalTicks > 0)) return false;

  const ae = ensureActiveEffects(world, id);
  if (!ae) return false;

  ae.effects.push({
    key: 'stat_envelope',
    stat: 'hearingImpairment',
    turnsLeft: totalTicks,
    potency: 1,
    startValue: 0,
    toValue: Math.max(0, Math.min(1, Number(toValue))),
    endValue: Math.max(0, Math.min(1, Number(endValue))),
    rampIn:  rampIn  | 0,
    hold:    holdFor | 0,
    rampOut: rampOut | 0,
  });
  return true;
}
