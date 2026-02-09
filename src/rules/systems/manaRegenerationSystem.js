import { Mana } from '../components/Mana.js';
import { Equipment } from '../components/Equipment.js';


/**
 * Increment mana up to maxMana using the component's manaRegen rate
 * plus any equipment-derived mana regen bonus.
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function manaRegenerationSystem(world) {
    for (const [entity, manaComp] of world.query(Mana)) {
        if (!manaComp) continue;
        if (manaComp.mana < manaComp.maxMana) {
            const baseRate = Number(manaComp.manaRegen ?? 0);
            const eq = world.get(entity, Equipment);
            const bonus = Number(eq?.manaRegenDerived ?? 0);
            const rate = baseRate + bonus;
            const newMana = Math.min(manaComp.maxMana, manaComp.mana + rate);
            world.set(entity, Mana, { ...manaComp, mana: newMana });
        }
    }
}