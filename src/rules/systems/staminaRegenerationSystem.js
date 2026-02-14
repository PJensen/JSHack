// staminaRegenerationSystem.js
// Regenerate stamina each turn using base regen + derived bonuses from equipment/status
import { Stamina } from '../components/Stamina.js';
import { Equipment } from '../components/Equipment.js';

/**
 * Regenerate stamina each turn based on base rate plus equipment bonuses.
 * Caps at effective max stamina (base + equipment bonuses).
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function staminaRegenerationSystem(world) {
  for (const [entity, staminaComp] of world.query(Stamina)) {
    if (!staminaComp) continue;

    // Cooldown: skip regen on turns where stamina was spent
    const cd = Number(staminaComp.regenCooldown ?? 0);
    if (cd > 0) {
      world.set(entity, Stamina, { ...staminaComp, regenCooldown: cd - 1 });
      continue;
    }

    const eq = world.get(entity, Equipment);
    const maxStaminaBonus = Number(eq?.maxStaminaDerived ?? 0);
    const effectiveMaxStamina = staminaComp.maxStamina + maxStaminaBonus;

    if (staminaComp.stamina >= effectiveMaxStamina) continue;

    const baseRate = Number(staminaComp.staminaRegen ?? 0);
    const regenBonus = Number(eq?.staminaRegenDerived ?? 0);
    const rate = baseRate + regenBonus;

    const newStamina = Math.min(effectiveMaxStamina, staminaComp.stamina + rate);
    world.set(entity, Stamina, { ...staminaComp, stamina: newStamina });
  }
}
