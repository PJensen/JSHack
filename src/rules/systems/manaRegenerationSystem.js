import { Mana } from '../components/Mana.js';
import { Equipment } from '../components/Equipment.js';
import { Status } from '../components/Status.js';


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
            // Hunger penalty: famished halves regen, starving/wasting stops it
            const _stat = world.get(entity, Status);
            let _hungerMult = 1.0;
            if (_stat && Array.isArray(_stat.statuses)) {
                const _hs = _stat.statuses.find(s => s.type === 'famished' || s.type === 'starving' || s.type === 'wasting');
                if (_hs) _hungerMult = _hs.type === 'famished' ? 0.5 : 0.0;
            }
            const rate = (baseRate + bonus) * _hungerMult;
            const newMana = Math.min(manaComp.maxMana, manaComp.mana + rate);
            world.set(entity, Mana, { ...manaComp, mana: newMana });
        }
    }
}