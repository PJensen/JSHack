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
            // A tiny regeneration-over-time example
            { key: "regen", potency: 1, onset: 0, peak: 0, duration: 5, stack: "refresh" }
        ],
    }],
    [ItemInfo, {
        type: "potion",
        description: "Restores health over a short duration.",
        weight: 0.5,
        value: 25,
        count: 1,
    }],
    [NamedIdentity, p => ({ name: p.name ?? "Health Potion" })],
);
