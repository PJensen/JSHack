// src/rules/utils/slime.js
// Slimed status effect — reduces movement speed temporarily.
// Applied by gelatinous cube or other gunk-based hazards.

import { ensureActiveEffects } from './effects.js';

/**
 * Apply slimed status to a target entity — reduces speed perception.
 * Manifests as a stat_envelope on a fictional 'sludgeLevel' stat.
 * Non-permanent: recovers completely after duration.
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} targetId
 * @returns {boolean}
 */
export function applySlimed(world, targetId) {
  const id = Number(targetId || 0) | 0;
  if (!(id > 0)) return false;
  if (!world.isAlive?.(id)) return false;

  const ae = ensureActiveEffects(world, id);
  if (!ae) return false;

  // 4-turn slimed effect (instant application, 4-turn hold, instant recovery)
  ae.effects.push({
    key: 'stat_envelope',
    stat: 'sludgeLevel',
    turnsLeft: 4,
    potency: 1,
    startValue: 0,
    toValue: 0.4, // moderate slowdown
    endValue: 0,
    rampIn: 0,
    hold: 4,
    rampOut: 0,
  });

  // Notify display/audio systems
  world.emit?.('status:slimed', { target: id, severity: 0.4 });

  return true;
}
