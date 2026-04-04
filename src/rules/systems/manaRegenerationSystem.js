import { Mana } from '../components/Mana.js';
import { HUNGER_MANA_MULT } from '../data/food.js';
import { getPassiveBonuses } from '../utils/passiveBonuses.js';
import { getResolvedStats } from '../utils/derivedStats.js';
import { statusStrength } from '../utils/statusFacade.js';


/**
 * Increment mana up to maxMana using the component's manaRegen rate
 * plus any equipment-derived mana regen bonus.
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function manaRegenerationSystem(world) {
    for (const [entity, manaComp] of world.query(Mana)) {
        if (!manaComp) continue;

        // Cooldown: skip regen on turns where mana was spent
        const cd = Number(manaComp.regenCooldown ?? 0);
        if (cd > 0) {
            manaComp.regenCooldown = cd - 1;
            continue;
        }

        const passive = getPassiveBonuses(world, entity);
        const maxBonus = Number(passive?.maxManaDerived ?? 0);
        const effectiveMaxMana = manaComp.maxMana + maxBonus;

        if (manaComp.mana < effectiveMaxMana) {
            const baseRate = Number(manaComp.manaRegen ?? 0);
            const bonus = Number(passive?.manaRegenDerived ?? 0);
            const derivedRegenMod = Number(getResolvedStats(world, entity)?.manaRegen ?? 0);
            // Hunger penalty: famished halves regen, starving/wasting stops it
            let _hungerMult = 1.0;
            const _hungerTypes = Object.keys(HUNGER_MANA_MULT);
            for (let i = 0; i < _hungerTypes.length; i++) {
                const _type = _hungerTypes[i];
                if (statusStrength(world, entity, _type) > 0) {
                    _hungerMult = Math.min(_hungerMult, Number(HUNGER_MANA_MULT[_type] || 1));
                }
            }
            const rate = Math.max(0, (baseRate + bonus + derivedRegenMod) * _hungerMult);
            manaComp.mana = Math.min(effectiveMaxMana, manaComp.mana + rate);
        }
    }
}
