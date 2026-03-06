import { defineComponent } from '../../lib/ecs-js/index.js';

/**
 * Weight component — tracks self weight and total (self + subtree) weight.
 *
 * - Items:      self = ItemInfo.weight * count,  total = self
 * - Containers: self = 0,  total = sum(children.total)
 *
 * Recomputed each tick by weightDerivationSystem (effects phase, bottom-up).
 */
export const Weight = defineComponent('Weight', {
  self: 0,
  total: 0,
});
