// staminaRegenerationSystem.js
// Regenerate stamina each turn using base regen + derived bonuses from equipment/status
import { Stamina } from '../components/Stamina.js';
import { getPassiveBonuses } from '../utils/passiveBonuses.js';
import { getResolvedStats } from '../utils/derivedStats.js';

/**
 * Regenerate stamina each turn based on base rate plus equipment bonuses.
 * Caps at effective max stamina (base + equipment bonuses).
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function staminaRegenerationSystem(world) {
  for (const [entity, staminaComp] of world.query(Stamina)) {
    if (!staminaComp) continue;

    // Cooldown: skip regen on turns where stamina was spent.
    // Direct mutation — world.set() defers during ticks and would
    // spread stale values, clobbering combat/dig deductions.
    const cd = Number(staminaComp.regenCooldown ?? 0);
    if (cd > 0) {
      staminaComp.regenCooldown = cd - 1;
      continue;
    }

    const passive = getPassiveBonuses(world, entity);
    const maxStaminaBonus = Number(passive?.maxStaminaDerived ?? 0);
    const effectiveMaxStamina = staminaComp.maxStamina + maxStaminaBonus;

    if (staminaComp.stamina >= effectiveMaxStamina) continue;

    const baseRate = Number(staminaComp.staminaRegen ?? 0);
    const regenBonus = Number(passive?.staminaRegenDerived ?? 0);
    const derivedRegenMod = Number(getResolvedStats(world, entity)?.staminaRegen ?? 0);
    const rate = Math.max(0, baseRate + regenBonus + derivedRegenMod);

    staminaComp.stamina = Math.min(effectiveMaxStamina, staminaComp.stamina + rate);
  }
}
