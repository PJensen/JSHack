import { defineComponent } from "../../lib/ecs-js/index.js";

// Hunger — tracks cumulative hunger on an entity.
// hunger: raw hunger counter (0 = full, increases by 1 each turn)
// satiation: bonus turns of satiation from overeating (decreases by 1 each turn before hunger rises)
export const Hunger = defineComponent('Hunger', {
  hunger: 0,
  satiation: 0,
}, {
  validate(rec) {
    if (typeof rec.hunger !== 'number' || rec.hunger < 0)
      throw new Error('Hunger.hunger must be >= 0');
    if (typeof rec.satiation !== 'number' || rec.satiation < 0)
      throw new Error('Hunger.satiation must be >= 0');
    return true;
  }
});
