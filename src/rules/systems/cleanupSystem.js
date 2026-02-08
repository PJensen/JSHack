// src/rules/systems/cleanupSystem.js
// Removes entities that have zero (or below) Vitality at the end of the current turn.
// Gameplay rationale: doing cleanup at the end of the turn prevents "dead men walking"
// in subsequent ticks while still allowing all systems in the current turn to react
// to the death (events, affixes, VFX, logging). In-engine, destroy() during a tick
// is deferred to the tick flush, so this acts as end-of-turn removal.

import { Vitality } from "../components/Vitality.js";
import { Inventory } from "../components/Inventory.js";
import { Position } from "../components/Position.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";

/**
 * Collect all entities with Vitality and remove those whose hp <= 0.
 * Keep this system small and deterministic; drops/epitaphs/etc. can be layered later.
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function cleanupSystem(world) {
  for (const [id, vit] of world.query(Vitality)) {
    if (!vit) continue;
    if ((vit.hp | 0) <= 0 && world.isAlive(id)) {
      // Drop all inventory items at the entity's current position before destroying
      const inv = world.get(id, Inventory);
      const pos = world.get(id, Position);
      if (inv && pos && Array.isArray(inv.items) && inv.items.length) {
        // copy list in case we mutate during loop
        const items = inv.items.slice();
        for (const itemId of items) {
          // Ensure item has identity and info retained; then place on ground
          const info = world.get(itemId, ItemInfo);
          const ident = world.get(itemId, NamedIdentity);
          // If the item was an inventory-only copy, it may lack Position; add it at corpse location
          try { world.add(itemId, Position, { x: pos.x, y: pos.y }); } catch { /* already had pos or deferred */ }
          // Emit event for display/bridges
          try { world.emit && world.emit('item:dropped', { actor: id, itemId, count: info?.count || 1, at: { x: pos.x, y: pos.y } }); } catch {}
        }
        // Clear inventory to reflect that items are no longer held
        inv.items.length = 0;
      }
      world.destroy(id);
    }
  }
}
