import { defineArchetype } from "../../lib/ecs-js/archetype.js";
import { NamedIdentity }          from "../components/NamedIdentity.js";
import { ItemInfo }          from "../components/ItemInfo.js";
import { Potion } from "../components/Potion.js";

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
