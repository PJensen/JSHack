import { defineComponent } from "../../lib/ecs-js/index.js";

// Vitality — basic hit points container for living things.
// Shape: { maxHp: number, hp: number }
export const Vitality = defineComponent('Vitality', {
  maxHp: 1,
  hp: 1
}, {
  validate(rec) {
    if (!rec) throw new Error('Vitality record required');
    if (typeof rec.maxHp !== 'number' || rec.maxHp <= 0) throw new Error('Vitality.maxHp must be > 0');
    if (typeof rec.hp !== 'number' || rec.hp < 0) throw new Error('Vitality.hp must be ≥ 0');
    if (rec.hp > rec.maxHp) rec.hp = rec.maxHp;
    return true;
  }
});
