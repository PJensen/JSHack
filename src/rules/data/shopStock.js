// rules/data/shopStock.js
// Generate shop inventory items for a shopkeeper.

import { createFrom } from '../../lib/ecs-js/archetype.js';
import { HealthPotion, ArrowsStack, ScrollOfMapping } from '../archetypes/Items.js';
import { resolveLootTable, materializeDrop } from './lootResolver.js';
import { Position } from '../components/Position.js';
import { ItemInfo } from '../components/ItemInfo.js';

/**
 * Generate a shopkeeper's stock as entity IDs (no Position component).
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} depth - current dungeon depth
 * @param {Object} rng - createRng() instance
 * @returns {number[]} array of item entity IDs
 */
export function generateShopStock(world, depth, rng) {
    const items = [];

    // Fixed staples: potions (3-5), arrows (1-2), scroll of mapping (1)
    const potionCount = rng.int(3, 5);
    for (let i = 0; i < potionCount; i++) {
        const id = createFrom(world, HealthPotion, {});
        try { world.remove(id, Position); } catch {}
        items.push(id);
    }

    const arrowCount = rng.int(1, 2);
    for (let i = 0; i < arrowCount; i++) {
        const id = createFrom(world, ArrowsStack, {});
        try { world.remove(id, Position); } catch {}
        items.push(id);
    }

    const scrollId = createFrom(world, ScrollOfMapping, {});
    try { world.remove(scrollId, Position); } catch {}
    items.push(scrollId);

    // Depth-scaled random equipment from the shop:equipment table
    const drops = resolveLootTable("shop:equipment", rng, depth);
    const dummyPos = { x: 0, y: 0 };
    for (const drop of drops) {
        if (drop.kind === "gold") continue; // shops don't sell gold
        const eid = materializeDrop(world, drop, dummyPos);
        if (eid != null) {
            try { world.remove(eid, Position); } catch {}
            // Scale value by depth for equipment
            const info = world.get(eid, ItemInfo);
            if (info && info.value > 0) {
                const depthMult = 1 + (depth - 1) * 0.15;
                world.mutate(eid, ItemInfo, r => {
                    r.value = Math.ceil(r.value * depthMult);
                });
            }
            items.push(eid);
        }
    }

    return items;
}

/**
 * Generate exactly one shop floor item entity ID (no Position component).
 * This avoids creating a whole stock list when only one item is needed.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} depth
 * @param {Object} rng
 * @returns {number|null}
 */
export function generateShopItem(world, depth, rng) {
    const roll = rng.next();

    // Staples appear often to keep early shops useful.
    if (roll < 0.35) {
        const id = createFrom(world, HealthPotion, {});
        try { world.remove(id, Position); } catch {}
        return id;
    }
    if (roll < 0.50) {
        const id = createFrom(world, ArrowsStack, {});
        try { world.remove(id, Position); } catch {}
        return id;
    }
    if (roll < 0.60) {
        const id = createFrom(world, ScrollOfMapping, {});
        try { world.remove(id, Position); } catch {}
        return id;
    }

    // Otherwise pull from shop equipment/magic/utility tables.
    const drops = resolveLootTable("shop:equipment", rng, depth);
    const dummyPos = { x: 0, y: 0 };
    for (const drop of drops) {
        if (drop.kind === "gold") continue;
        const eid = materializeDrop(world, drop, dummyPos);
        if (eid == null) continue;
        try { world.remove(eid, Position); } catch {}
        const info = world.get(eid, ItemInfo);
        if (info && info.value > 0) {
            const depthMult = 1 + (depth - 1) * 0.15;
            world.mutate(eid, ItemInfo, r => {
                r.value = Math.ceil(r.value * depthMult);
            });
        }
        return eid;
    }

    // Fallback so shop_item spawn always materializes.
    const fallback = createFrom(world, HealthPotion, {});
    try { world.remove(fallback, Position); } catch {}
    return fallback;
}
