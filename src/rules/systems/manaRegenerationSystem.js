import { Mana } from '../components/Mana.js';


/**
 * Increment mana up to maxMana using the component's manaRegen rate.
 * @param {import('../../lib/ecs-js').World} world
 */
export function manaRegenerationSystem(world) {
    for (const [entity, manaComp] of world.query(Mana)) {
        if (!manaComp) continue;
        if (manaComp.mana < manaComp.maxMana) {
            const rate = Number(manaComp.manaRegen ?? 0);
            const newMana = Math.min(manaComp.maxMana, manaComp.mana + rate);
            world.set(entity, Mana, { ...manaComp, mana: newMana });
        }
    }
}