import { Mana } from '../components/Mana.js';
import { Equipment } from '../components/Equipment.js';
import { HUNGER_MANA_MULT } from '../data/food.js';
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

        const eq = world.get(entity, Equipment);
        const maxBonus = Number(eq?.maxManaDerived ?? 0);
        const effectiveMaxMana = manaComp.maxMana + maxBonus;

        if (manaComp.mana < effectiveMaxMana) {
            const baseRate = Number(manaComp.manaRegen ?? 0);
            const bonus = Number(eq?.manaRegenDerived ?? 0);
            // Hunger penalty: famished halves regen, starving/wasting stops it
            let _hungerMult = 1.0;
            const _hungerTypes = Object.keys(HUNGER_MANA_MULT);
            for (let i = 0; i < _hungerTypes.length; i++) {
                const _type = _hungerTypes[i];
                if (statusStrength(world, entity, _type) > 0) {
                    _hungerMult = Math.min(_hungerMult, Number(HUNGER_MANA_MULT[_type] || 1));
                }
            }
            const rate = (baseRate + bonus) * _hungerMult;
            manaComp.mana = Math.min(effectiveMaxMana, manaComp.mana + rate);
        }
    }
}
