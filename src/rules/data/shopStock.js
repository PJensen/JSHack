// rules/data/shopStock.js
// Generate shop inventory items for a shopkeeper.

import { createFrom } from '../../lib/ecs-js/archetype.js';
import { HealthPotion, ArrowsStack, ScrollOfMapping, GemItem } from '../archetypes/Items.js';
import { resolveLootTable, materializeDrop } from './lootResolver.js';
import { Position } from '../components/Position.js';
import { ItemInfo } from '../components/ItemInfo.js';
import * as gems from './gems.js';
import { createItemById } from '../utils/itemFactory.js';

function stripPosition(world, id) {
    try { world.remove(id, Position); } catch {}
    return id;
}

function chooseWeighted(rng, entries) {
    let total = 0;
    for (let i = 0; i < entries.length; i++) total += Number(entries[i].weight || 0);
    if (!(total > 0)) return entries[0] || null;
    let roll = rng.next() * total;
    for (let i = 0; i < entries.length; i++) {
        roll -= Number(entries[i].weight || 0);
        if (roll <= 0) return entries[i];
    }
    return entries[entries.length - 1] || null;
}

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
        try { world.remove(id, Position); } catch {} // ECS: may not exist
        items.push(id);
    }

    const arrowCount = rng.int(1, 2);
    for (let i = 0; i < arrowCount; i++) {
        const id = createFrom(world, ArrowsStack, {});
        try { world.remove(id, Position); } catch {} // ECS: may not exist
        items.push(id);
    }

    const scrollId = createFrom(world, ScrollOfMapping, {});
    try { world.remove(scrollId, Position); } catch {} // ECS: may not exist
    items.push(scrollId);

    // Depth-scaled random equipment from the shop:equipment table
    const drops = resolveLootTable("shop:equipment", rng, depth);
    const dummyPos = { x: 0, y: 0 };
    for (const drop of drops) {
        if (drop.kind === "gold") continue; // shops don't sell gold
        const eid = materializeDrop(world, drop, dummyPos);
        if (eid != null) {
            try { world.remove(eid, Position); } catch {} // ECS: may not exist
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
        return stripPosition(world, createFrom(world, HealthPotion, {}));
    }
    if (roll < 0.50) {
        return stripPosition(world, createFrom(world, ArrowsStack, {}));
    }
    if (roll < 0.60) {
        return stripPosition(world, createFrom(world, ScrollOfMapping, {}));
    }

    // Otherwise pull from shop equipment/magic/utility tables.
    const drops = resolveLootTable("shop:equipment", rng, depth);
    const dummyPos = { x: 0, y: 0 };
    for (const drop of drops) {
        if (drop.kind === "gold") continue;
        const eid = materializeDrop(world, drop, dummyPos);
        if (eid == null) continue;
        stripPosition(world, eid);
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
    return stripPosition(world, createFrom(world, HealthPotion, {}));
}

/**
 * Generate exactly one apothecary floor item entity ID (no Position component).
 * Authored alchemy shops use this for visible floor stock markers.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {Object} rng
 * @returns {number|null}
 */
export function generateAlchemyShopItem(world, rng) {
    const pick = chooseWeighted(rng, [
        { id: "potion_health", weight: 24 },
        { id: "potion_mana", weight: 16 },
        { id: "potion_anti_venom", weight: 12 },
        { id: "potion_vigor", weight: 10 },
        { id: "potion_endurance", weight: 10 },
        { id: "potion_second_wind", weight: 8 },
        { id: "potion_resist_poison", weight: 8 },
        { id: "potion_resist_fire", weight: 6 },
        { id: "potion_resist_electric", weight: 4 },
        { id: "potion_resist_acid", weight: 4 },
    ]);
    if (!pick?.id) return stripPosition(world, createFrom(world, HealthPotion, {}));
    const itemId = createItemById(world, pick.id);
    if (!(itemId > 0)) return stripPosition(world, createFrom(world, HealthPotion, {}));
    return stripPosition(world, itemId);
}

/**
 * Generate gem vendor stock: socketable gems (pre-identified) + misc gems.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {Object} rng - createRng() instance
 * @returns {number[]} array of item entity IDs
 */
export function generateGemShopStock(world, rng) {
    const items = [];

    // Socketable gems: pick 3-4 from the socketable pool, pre-identified
    const socketableGems = gems.listGems().filter(g => g.socketable && g.material === 'gemstone');
    const socketCount = rng.int(3, 4);
    // Deterministic shuffle via rng
    const pool = socketableGems.slice();
    for (let i = pool.length - 1; i > 0; i--) {
        const j = rng.int(0, i);
        const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    for (let i = 0; i < Math.min(socketCount, pool.length); i++) {
        const gem = pool[i];
        const params = gems.buildGemItemParams(gem, { identified: true });
        if (!params) continue;
        const id = createFrom(world, GemItem, params);
        try { world.remove(id, Position); } catch {}
        items.push(id);
    }

    // Misc gems: 4-6 common gemstones, also sold pre-identified in the gem shop.
    const miscPool = gems.listGems().filter(g => g.material === 'gemstone' && g.value > 0 && g.prob > 0);
    const miscCount = rng.int(4, 6);
    for (let i = 0; i < miscCount; i++) {
        const gem = miscPool[rng.int(0, miscPool.length - 1)];
        const params = gems.buildGemItemParams(gem, { identified: true });
        if (!params) continue;
        const id = createFrom(world, GemItem, params);
        try { world.remove(id, Position); } catch {}
        items.push(id);
    }

    return items;
}
