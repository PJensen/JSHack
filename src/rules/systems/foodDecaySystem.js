// src/rules/systems/foodDecaySystem.js
// Per-tick food decay system.
// Phase: effects (after hungerSystem)
// Iterates inventory items with FoodDecay, increments turnsHeld,
// and emits events on decay stage transitions.

import { Inventory } from '../components/Inventory.js';
import { ItemInfo } from '../components/ItemInfo.js';
import { FoodDecay } from '../components/FoodDecay.js';
import { NamedIdentity } from '../components/NamedIdentity.js';
import { getDecayStage } from '../data/food.js';
import { inventoryItems } from '../utils/inventoryFacade.js';

/**
 * foodDecaySystem — advances food rot for items held in inventories.
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function foodDecaySystem(world) {
  for (const [ownerId] of world.query(Inventory)) {
    for (const itemId of inventoryItems(world, ownerId)) {
      const decay = world.get(itemId, FoodDecay);
      if (!decay) continue;

      const info = world.get(itemId, ItemInfo);
      if (!info || info.type !== 'food') continue;

      // Snapshot previous stage before incrementing
      const prevStage = getDecayStage(decay.turnsHeld, decay.shelfLife).stage;

      // Advance decay
      decay.turnsHeld += 1;

      // Check for stage transition
      const next = getDecayStage(decay.turnsHeld, decay.shelfLife);
      if (next.stage !== prevStage) {
        const ni = world.get(itemId, NamedIdentity);
        const itemName = ni?.name || info.description || 'food';
        try {
          world.emit && world.emit('food:decayed', {
            ownerId,
            itemId,
            stage: next.stage,
            itemName,
          });
        } catch { /* */ }
      }
    }
  }
}
