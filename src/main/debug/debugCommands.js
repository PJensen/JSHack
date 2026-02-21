// src/main/debug/debugCommands.js
// Process ?give and ?effects URL param debug commands at boot.

import { playerEntity } from "../../rules/utils/queries.js";
import { Inventory } from "../../rules/components/Inventory.js";
import { ActiveEffects } from "../../rules/components/ActiveEffects.js";
import { createItemById } from "../../rules/utils/itemFactory.js";
import { addItemEntityToInventory } from "../../rules/utils/inventoryStacking.js";

/**
 * Apply URL-param debug commands (?give, ?effects) to the player.
 * @param {{ world: import('../../lib/ecs-js/index.js').World, runtimeConfig: { giveParam?: string, effectsParam?: string } }} deps
 */
export function applyDebugCommands({ world, runtimeConfig }) {
  // Process ?give query string parameter to spawn items in player inventory
  // Format: ?give=item_id*count,item_id*count
  // Example: ?give=gold*1000,potion_health*5,sword_plain*1
  {
    const giveParam = runtimeConfig.giveParam;
    if (giveParam) {
      const pe = playerEntity(world);
      if (pe) {
        const inv = world.get(pe.id, Inventory);
        if (inv && Array.isArray(inv.items)) {
          // Parse comma-separated item specs
          const specs = giveParam.split(',').map(s => s.trim()).filter(Boolean);

          for (const spec of specs) {
            // Parse "item_id*count" format
            const match = spec.match(/^([a-z_]+)(?:\*(\d+))?$/i);
            if (!match) {
              console.warn(`[?give] Invalid format: "${spec}" (expected: item_id*count)`);
              continue;
            }

            const itemId = match[1];
            const count = parseInt(match[2] || '1', 10);

            if (!Number.isFinite(count) || count < 1) {
              console.warn(`[?give] Invalid count for "${itemId}": ${match[2]}`);
              continue;
            }

            try {
              // Use centralized item factory
              const createdItemId = createItemById(world, itemId, { count });

              if (createdItemId !== null) {
                addItemEntityToInventory(world, inv, createdItemId);
                console.debug(`[?give] Created ${count}x ${itemId}`);
              } else {
                console.warn(`[?give] Unknown item: "${itemId}"`);
              }
            } catch (err) {
              console.error(`[?give] Error creating item "${itemId}":`, err);
            }
          }
        }
      }
    }
  }

  // Process ?effects query string parameter to apply status effects to the player.
  // Format: ?effects=key*turns,key*turns   (turns defaults to 5 if omitted)
  // Example: ?effects=bleed*2,poison*10,burning,confused*3
  {
    const effectsParam = runtimeConfig.effectsParam;
    if (effectsParam) {
      const pe = playerEntity(world);
      if (pe) {
        const ae = world.get(pe.id, ActiveEffects);
        const specs = effectsParam.split(',').map(s => s.trim()).filter(Boolean);
        for (const spec of specs) {
          const match = spec.match(/^([a-z_]+)(?:\*(\d+))?$/i);
          if (!match) {
            console.warn(`[?effects] Invalid format: "${spec}" (expected: key or key*turns)`);
            continue;
          }
          const key = match[1].toLowerCase();
          const turnsLeft = parseInt(match[2] || '5', 10);
          if (!Number.isFinite(turnsLeft) || turnsLeft < 1) {
            console.warn(`[?effects] Invalid turns for "${key}": ${match[2]}`);
            continue;
          }
          const effect = { key, turnsLeft, potency: 1, stacks: 1 };
          if (ae && Array.isArray(ae.effects)) {
            ae.effects.push(effect);
          } else {
            world.add(pe.id, ActiveEffects, { effects: [effect] });
          }
          console.debug(`[?effects] Applied ${key} for ${turnsLeft} turn(s)`);
        }
      }
    }
  }
}
