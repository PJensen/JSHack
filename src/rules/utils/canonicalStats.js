import { getPassiveBonuses } from "./passiveBonuses.js";
import { resolveDerivedStats } from "./derivedStats.js";

/**
 * Merge all stat inputs into a canonical stat view for combat/damage consumers.
 * Derived-expression stats are authoritative semantic channels; passive/equipment
 * bonuses are treated as additional input sources to those channels.
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} entityId
 */
export function resolveCanonicalStats(world, entityId) {
  const id = Number(entityId || 0) | 0;
  const resolved = resolveDerivedStats(world, id);
  const passive = getPassiveBonuses(world, id);

  const accuracyDerived = Number(passive?.accuracyDerived || 0);
  const damagePowerDerived = Number(passive?.damagePowerDerived || 0);
  const evadeDerived = Number(passive?.evadeDerived || 0);
  const mitigationDerived = Number(passive?.mitigationDerived || passive?.kineticDRDerived || 0);
  const critChanceDerived = Number(passive?.critChanceDerived || 0);
  const critMultDerived = Number(passive?.critMultDerived || 0);

  return Object.freeze({
    ...resolved,
    accuracy: Number(resolved?.accuracy || 0) + accuracyDerived,
    damagePower: Number(resolved?.damagePower || 0) + damagePowerDerived,
    evade: Number(resolved?.evade || 0) + evadeDerived,
    mitigation: Number(resolved?.mitigation || 0) + mitigationDerived,
    critChancePhysical: Number(resolved?.critChancePhysical || 0) + critChanceDerived,
    critChanceSpell: Number(resolved?.critChanceSpell || 0) + critChanceDerived,
    critMultPhysical: Number(resolved?.critMultPhysical || 0) + critMultDerived,
    critMultSpell: Number(resolved?.critMultSpell || 0) + critMultDerived,
    luck: Number(resolved?.luck || 0) + Number(passive?.luckDerived || 0),
    spellHit: Number(resolved?.spellHit || 0) + Number(passive?.spellHitDerived || 0),
    spellAvoid: Number(resolved?.spellAvoid || 0) + Number(passive?.spellAvoidDerived || 0),
    kineticDR: Number(resolved?.kineticDR || 0) + Number(passive?.kineticDRDerived || 0),
    fireResist: Number(resolved?.fireResist || 0) + Number(passive?.fireResistDerived || 0),
    poisonResist: Number(resolved?.poisonResist || 0) + Number(passive?.poisonResistDerived || 0),
    acidResist: Number(resolved?.acidResist || 0) + Number(passive?.acidResistDerived || 0),
    radiationResist: Number(resolved?.radiationResist || 0) + Number(passive?.radiationResistDerived || 0),
    electricOhms: Number(resolved?.electricOhms || 0) + Number(passive?.electricOhmsDerived || 0),
    bluntResist: Number(resolved?.bluntResist || 0) + Number(passive?.bluntResistDerived || 0),
    slashResist: Number(resolved?.slashResist || 0) + Number(passive?.slashResistDerived || 0),
    pierceResist: Number(resolved?.pierceResist || 0) + Number(passive?.pierceResistDerived || 0),
    spellRadius: Number(resolved?.spellRadius || 0) + Number(passive?.spellRadiusDerived || 0),
    visionRange: Number(resolved?.visionRange || 0) + Number(passive?.visionRangeDerived || 0),
    hungerRate: Number(resolved?.hungerRate || 0) + Number(passive?.hungerRateDerived || 0),
    staminaRegen: Number(resolved?.staminaRegen || 0) + Number(passive?.staminaRegenDerived || 0),
  });
}
