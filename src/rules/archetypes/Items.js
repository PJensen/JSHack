import { defineArchetype } from "../../lib/ecs-js/archetype.js";
import { NamedIdentity }          from "../components/NamedIdentity.js";
import { ItemInfo }          from "../components/ItemInfo.js";
import { Potion } from "../components/Potion.js";
import { Consumable } from "../components/Consumable.js";
import { Material } from "../components/Material.js";

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
    [Material, { kind: "glass" }],
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
    [Material, { kind: "gold" }],
);

// Stackable arrows (ammo) — planning for ranged ammo consumption
export const ArrowsStack = defineArchetype(
    "ArrowsStack",
    [ItemInfo, {
        type: "ammo",
        slot: "ammo",
        description: "A bundle of arrows.",
        weight: 0.2,
        value: 1,
        count: 10,
    }],
    [NamedIdentity, /** @param {any} p */ (p) => ({ name: (p && p.name) ?? "Arrows", identity: "ammo_arrows" })],
    [Material, { kind: "wood" }],
);

// Fire arrows — bonus 1d4 fire damage on hit
export const FireArrowsStack = defineArchetype(
    "FireArrowsStack",
    [ItemInfo, {
        type: "ammo",
        slot: "ammo",
        subtype: "fire",
        description: "Arrows tipped with alchemical fire.",
        weight: 0.3,
        value: 5,
        count: 5,
    }],
    [NamedIdentity, /** @param {any} p */ (p) => ({ name: (p && p.name) ?? "Fire Arrows", identity: "ammo_fire_arrows" })],
    [Material, { kind: "wood" }],
);

// Generic magic item (spellbooks, wands, scrolls) — resolves from item def params
export const MagicItem = defineArchetype(
    "MagicItem",
    [NamedIdentity, (p) => ({ name: p.name ?? "Item", identity: p.identity ?? "item" })],
    [ItemInfo, (p) => ({
        type: p.type ?? "learn",
        slot: p.slot ?? "bag",
        weight: p.weight ?? 1,
        value: p.value ?? 0,
        description: p.description ?? "",
        count: p.count ?? 1,
        rarity: p.rarity ?? 1,
        rarityName: p.rarityName ?? "common",
        affixes: [],
    })],
);

// Gem / stone — parameterized from GEM_DEFS at creation time
export const GemItem = defineArchetype(
    "GemItem",
    [NamedIdentity, (p) => ({ name: p.name ?? "gem", identity: p.identity ?? "gem" })],
    [ItemInfo, (p) => ({
        type: "gem",
        slot: "bag",
        weight: p.weight ?? 1,
        value: p.value ?? 0,
        description: p.description ?? "",
        count: 1,
        rarity: 1,
        rarityName: "common",
        affixes: [],
    })],
);

// Debug/utility: reveals entire dungeon map when used
export const ScrollOfMapping = defineArchetype(
    "ScrollOfMapping",
    [Consumable, {
        effectKey: 'consumable:mapping',
        effectParams: {},
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
    [Material, { kind: "paper" }],
);
