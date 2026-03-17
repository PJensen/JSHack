// src/rules/utils/blind.js
// Temporal stat envelope for the vision stat.
// Implements a ramp-in / hold / ramp-out modifier that drives effective vision range
// without mutating the base Brain.visionRange value.
//
// Spell surface:
//   blind(world, target, toValue, rampIn, holdFor, rampOut, endValue?)
//
// The modifier is stored as a 'stat_envelope' entry in ActiveEffects.
// getEffectiveVisionRange() computes the canonical read of the vision stat,
// including any active envelope modifiers.

import { Brain } from '../components/Brain.js';
import { ActiveEffects } from '../components/ActiveEffects.js';
import { getPassiveBonuses } from './passiveBonuses.js';

/**
 * Piecewise-linear envelope interpolation.
 * Deterministic: value is computed from elapsed ticks alone, not accumulated deltas.
 *
 * Phases:
 *   [0, rampIn)            : startValue → toValue
 *   [rampIn, rampIn+hold)  : toValue (hold)
 *   [rampIn+hold, total]   : toValue → endValue
 *
 * @param {number} startValue
 * @param {number} toValue
 * @param {number} endValue
 * @param {number} rampIn   ticks to ramp from startValue to toValue
 * @param {number} hold     ticks to remain at toValue
 * @param {number} rampOut  ticks to ramp from toValue to endValue
 * @param {number} elapsed  ticks elapsed since application
 * @returns {number}
 */
export function computeEnvelopeValue(startValue, toValue, endValue, rampIn, hold, rampOut, elapsed) {
  if (elapsed <= 0) return startValue;
  const total = (Number(rampIn) || 0) + (Number(hold) || 0) + (Number(rampOut) || 0);
  if (elapsed > total) return endValue;

  // Ramp-in phase
  if (rampIn > 0 && elapsed <= rampIn) {
    const t = elapsed / rampIn;
    return startValue + (toValue - startValue) * t;
  }

  // Hold phase: elapsed is in [rampIn, rampIn + hold]
  if (elapsed <= rampIn + hold) {
    return toValue;
  }

  // Ramp-out phase (or instant jump when rampOut === 0)
  if (rampOut <= 0) return toValue;
  const t = (elapsed - rampIn - hold) / rampOut;
  return toValue + (endValue - toValue) * Math.min(1, t);
}

/**
 * Sum the vision modifiers contributed by all active stat_envelope effects
 * that target the 'visionRange' stat on an entity.
 *
 * The modifier = currentEnvelopeValue - startValue.
 * Callers add this to the base vision to get the effective value.
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} entityId
 * @returns {number}
 */
export function computeVisionEnvelopeModifier(world, entityId) {
  const ae = world.get(entityId, ActiveEffects);
  if (!ae?.effects?.length) return 0;

  let total = 0;
  for (const e of ae.effects) {
    if (!e || e.key !== 'stat_envelope' || e.stat !== 'visionRange') continue;
    const rampIn  = Number(e.rampIn  || 0);
    const hold    = Number(e.hold    || 0);
    const rampOut = Number(e.rampOut || 0);
    const totalTicks = rampIn + hold + rampOut;
    const elapsed = totalTicks - (Number.isInteger(e.turnsLeft) ? e.turnsLeft : 0);
    const envelopeValue = computeEnvelopeValue(
      Number(e.startValue ?? 0),
      Number(e.toValue    ?? 0),
      Number(e.endValue   ?? e.startValue ?? 0),
      rampIn, hold, rampOut, elapsed
    );
    total += envelopeValue - Number(e.startValue ?? 0);
  }
  return total;
}

/**
 * Canonical effective vision range for an entity.
 * Combines brain base, passive (equipment) bonuses, and any active envelope modifiers.
 * Always ≥ 0.
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} entityId
 * @returns {number}
 */
export function getEffectiveVisionRange(world, entityId) {
  const id = Number(entityId || 0) | 0;
  if (!(id > 0)) return 0;

  const brain   = world.get(id, Brain);
  const passive = getPassiveBonuses(world, id);
  const base    = Number(brain?.visionRange ?? 8);
  const equip   = Number(passive?.visionRangeDerived ?? 0);
  const modifier = computeVisionEnvelopeModifier(world, id);

  return Math.max(0, base + equip + modifier);
}

/**
 * Apply a temporal vision-pressure effect to a target entity.
 * Captures the current effective vision as startValue unless overridden via opts.
 *
 * Signature mirrors the issue spec:
 *   blind(world, target, toValue, rampIn, holdFor, rampOut, endValue?)
 *
 * endValue defaults to startValue (full recovery after ramp-out).
 * To model permanent damage: pass endValue !== startValue with rampOut = 0.
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} targetId
 * @param {number} toValue    minimum vision reached at end of ramp-in / during hold
 * @param {number} rampIn     ticks to reach toValue
 * @param {number} holdFor    ticks to hold at toValue
 * @param {number} rampOut    ticks to recover from toValue to endValue
 * @param {number} [endValue] final value after recovery; defaults to captured startValue
 * @returns {boolean} false if the target has no ActiveEffects component and one could not be added
 */
export function blind(world, targetId, toValue, rampIn, holdFor, rampOut, endValue = undefined) {
  const id = Number(targetId || 0) | 0;
  if (!(id > 0)) return false;

  const totalTicks = (rampIn | 0) + (holdFor | 0) + (rampOut | 0);
  if (!(totalTicks > 0)) return false;

  // Capture current effective vision as start value
  const startValue = getEffectiveVisionRange(world, id);
  const resolvedEndValue = (endValue !== undefined) ? endValue : startValue;

  let ae = world.get(id, ActiveEffects);
  if (!ae) {
    try { world.add(id, ActiveEffects, { effects: [] }); } catch { /* already exists */ }
    ae = world.get(id, ActiveEffects);
  }
  if (!ae || !Array.isArray(ae.effects)) return false;

  ae.effects.push({
    key: 'stat_envelope',
    stat: 'visionRange',
    turnsLeft: totalTicks,
    potency: 1,
    startValue,
    toValue: Number(toValue),
    endValue: resolvedEndValue,
    rampIn:  rampIn  | 0,
    hold:    holdFor | 0,
    rampOut: rampOut | 0,
  });
  return true;
}
