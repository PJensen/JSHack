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
import { DungeonState } from "../components/DungeonState.js";
import { Pet } from "../components/Pet.js";
import { Owner } from "../components/Owner.js";
import { Player } from "../components/Player.js";
import { createRng } from "../../lib/ecs-js/rng.js";
import { getMonster, getMonsterLootTable } from "../data/monsters.js";
import { dropLoot } from "../data/lootResolver.js";
import { createCorpse } from "../archetypes/Food.js";

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
          try { world.emit && world.emit('item:dropped', { actor: id, itemId, count: info?.count || 1, at: { x: pos.x, y: pos.y } }); } catch (e) { console.debug('[cleanupSystem] emit item:dropped failed:', e); }
        }
        // Clear inventory to reflect that items are no longer held
        inv.items.length = 0;
      }
      // Check if this was a pet before cleanup
      const wasPet = world.has(id, Pet);
      let petOwnerId = 0;
      if (wasPet) {
        // Find the owner (player who had this pet)
        for (const [playerId] of world.query(Player)) {
          petOwnerId = playerId;
          break;
        }
      }

      // Generate loot from monster's loot table
      const ident = world.get(id, NamedIdentity);
      if (ident && pos) {
        const monsterDef = getMonster(ident.identity);

        // For pets without monster definitions, create a fallback definition
        const effectiveMonsterDef = monsterDef || (wasPet ? {
          id: ident.identity || 'pet',
          name: ident.name || 'Pet',
          sizeClass: 'S',
          massKg: 10,
          tier: 0
        } : null);

        if (effectiveMonsterDef) {
          // Drop loot only if there's a real monster definition with a loot table
          if (monsterDef) {
            const tableId = getMonsterLootTable(monsterDef);
            const step = world.step | 0;
            const lootSeed = ((world.seed >>> 0) ^ ((step * 0x9e3779b9) >>> 0) ^ ((id * 0x517cc1b7) >>> 0)) >>> 0;
            const rng = createRng(lootSeed);
            let depth = 1;
            for (const [, ds] of world.query(DungeonState)) { depth = ds.currentDepth || 1; break; }
            dropLoot(world, tableId, rng, depth, { x: pos.x, y: pos.y });
          }

          // Drop a corpse for the killed monster or pet
          // Pets ALWAYS drop corpses (100% chance)
          // Other monsters: Base 75% chance, +8% per tier (higher tier = more guaranteed)
          const corpseChance = wasPet ? 1.0 : Math.min(1.0, 0.75 + (effectiveMonsterDef.tier || 0) * 0.08);
          // Use the RNG if available, otherwise just check corpseChance directly
          let shouldCreateCorpse = false;
          if (monsterDef) {
            const step = world.step | 0;
            const lootSeed = ((world.seed >>> 0) ^ ((step * 0x9e3779b9) >>> 0) ^ ((id * 0x517cc1b7) >>> 0)) >>> 0;
            const rng = createRng(lootSeed);
            const corpseRoll = rng.next();
            shouldCreateCorpse = corpseRoll < corpseChance;
          } else {
            // For pets without monster defs, always create corpse
            shouldCreateCorpse = wasPet;
          }

          if (shouldCreateCorpse) {
            const corpseId = createCorpse(world, effectiveMonsterDef, { x: pos.x, y: pos.y });

            // If this was a pet, mark the corpse with Pet tag and Owner
            if (wasPet && petOwnerId) {
              try {
                world.add(corpseId, Pet);
                world.add(corpseId, Owner, { ownerId: petOwnerId });
              } catch { /* */ }
            }

            try { world.emit && world.emit('item:dropped', { itemId: corpseId, count: 1, at: { x: pos.x, y: pos.y } }); } catch { /* */ }
          }
        }
      }

      // Emit betrayal event if a pet died
      if (wasPet && petOwnerId) {
        try {
          world.emit && world.emit('pet:died', {
            petId: id,
            ownerId: petOwnerId,
            name: ident?.name || 'pet',
            at: pos
          });
        } catch { /* */ }
      }

      world.destroy(id);
    }
  }
}
