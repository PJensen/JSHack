import { defineArchetype } from "../../lib/ecs-js/archetype.js";
import { NamedIdentity }          from "../components/NamedIdentity.js";
import { ItemInfo }          from "../components/ItemInfo.js";
import { Potion } from "../components/Potion.js";
import { Consumable } from "../components/Consumable.js";
import { forEachLoadedTile } from "../environment/dungeon/tileMap.js";
import { markExplored } from "../environment/dungeon/exploredMap.js";

// Simple Health Potion archetype using Potion component
export const HealthPotion = defineArchetype(
    "HealthPotion",
    [Potion, {
        name: "Health Potion",
        route: "oral",
        doses: 1,
        channels: [],
        effects: [
            // Regeneration-over-time; potency resolved as % of max HP at use time (see drinkSystem)
            { key: "regen", potency: 0, onset: 0, peak: 0, duration: 8, stack: "refresh", meta: { percentOfMaxHp: 0.03 } }
        ],
    }],
    [ItemInfo, {
        type: "potion",
        description: "Restores health over a short duration.",
        weight: 0.5,
        value: 25,
        count: 1,
    }],
    [NamedIdentity, /** @param {any} p */ (p) => ({ name: (p && p.name) ?? "Health Potion", identity: 'potion_health' })],
);

// Currency stack (Gold) — zero weight, stackable via ItemInfo.count
export const GoldStack = defineArchetype(
    "GoldStack",
    [ItemInfo, {
        type: "currency",
        description: "Gold coins",
        weight: 0,
        value: 1, // per coin
        count: 1,
    }],
    [NamedIdentity, /** @param {any} p */ (p) => ({ name: (p && p.name) ?? "Gold", identity: "gold" })],
);

// Stackable arrows (ammo) — planning for ranged ammo consumption
export const ArrowsStack = defineArchetype(
    "ArrowsStack",
    [ItemInfo, {
        type: "ammo",
        description: "A bundle of arrows.",
        weight: 0.2,
        value: 1,
        count: 10,
    }],
    [NamedIdentity, /** @param {any} p */ (p) => ({ name: (p && p.name) ?? "Arrows", identity: "ammo_arrows" })],
);

// Fire arrows — bonus 1d4 fire damage on hit
export const FireArrowsStack = defineArchetype(
    "FireArrowsStack",
    [ItemInfo, {
        type: "ammo",
        subtype: "fire",
        description: "Arrows tipped with alchemical fire.",
        weight: 0.3,
        value: 5,
        count: 5,
    }],
    [NamedIdentity, /** @param {any} p */ (p) => ({ name: (p && p.name) ?? "Fire Arrows", identity: "ammo_fire_arrows" })],
);

// Debug/utility: reveals entire dungeon map when used
export const ScrollOfMapping = defineArchetype(
    "ScrollOfMapping",
    [Consumable, {
        useEffect: (_world, _actor, _itemId) => {
            forEachLoadedTile((x, y) => markExplored(x, y));
        },
        remainingUses: 1,
        potency: 0,
    }],
    [ItemInfo, {
        type: "scroll",
        description: "Reveals the entire dungeon map.",
        weight: 0.1,
        value: 100,
        count: 1,
    }],
    [NamedIdentity, (p) => ({ name: (p && p.name) ?? "Scroll of Mapping", identity: "scroll_mapping" })],
);
