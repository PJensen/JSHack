import { defineArchetype } from "../../lib/ecs-js/archetype.js";
import { NamedIdentity }          from "../components/NamedIdentity.js";
import { ItemInfo }          from "../components/ItemInfo.js";
import { Potion } from "../components/Potion.js";
import { Consumable } from "../components/Consumable.js";
import { useEffect } from "react";

export const HealthPotion = defineArchetype("GenericPotion",
    [Consumable, { 
        uses: 1, 
        useEffect: (entity, context) => {
            const actor = context.getEntity(entity.ownerId);
            if (!actor) return;
        },
        meta: {}
    }],
    [ItemInfo, { 
        type: "potion",
        description: "A small vial containing a red liquid that restores health when consumed.",
        weight: 0.5,
        value: 25,
        stackable: true,
    }],
    [NamedIdentity, p => ({
        name: p.name ?? "Generic Potion"
    })],
);
