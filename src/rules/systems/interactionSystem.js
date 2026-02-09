// src/rules/systems/interactionSystem.js
import { Interactable } from "../components/Interactable.js";
import { InteractIntent } from "../components/Intents/InteractIntent.js";
import { DoorState } from "../components/DoorState.js";
import { Collider } from "../components/Collider.js";
import { Position } from "../components/Position.js";
import { DungeonState } from "../components/DungeonState.js";
import { createRng } from "../../lib/ecs-js/rng.js";
import { dropLoot } from "../data/lootResolver.js";

// One-off helper invoked by the per-tick interactionSystem below
export function InteractionSystem(world, actor, targetId) {
    const inter = world.get(targetId, Interactable);
    if (!inter) return false;

    switch (inter.action) {
        case "toggleDoor":
            {
                // Toggle DoorState and update Collider.solid/blocksSight accordingly
                const ds = world.get(targetId, DoorState);
                if (ds?.locked) {
                    world.emit?.("interaction", { actor, targetId, action: "toggleDoor", result: "locked" });
                    break;
                }
                const nowOpen = !(ds?.open);
                if (ds) world.set(targetId, DoorState, { open: nowOpen });
                const col = world.get(targetId, Collider);
                if (col) world.set(targetId, Collider, { solid: !nowOpen, blocksSight: !nowOpen });
                world.emit?.("interaction", { actor, targetId, action: "toggleDoor", result: nowOpen ? "opened" : "closed" });
            }
            break;

        case "openChest":
            {
                const lootTableId = inter.params?.lootTable || "chest:basic";
                const chestSeed = ((world.seed >>> 0) ^ ((targetId * 0x9e3779b9) >>> 0) ^ 0xCE57) >>> 0;
                const rng = createRng(chestSeed);
                let depth = 1;
                for (const [, ds] of world.query(DungeonState)) { depth = ds.currentDepth || 1; break; }
                const chestPos = world.get(targetId, Position);
                const droppedIds = chestPos
                    ? dropLoot(world, lootTableId, rng, depth, { x: chestPos.x, y: chestPos.y })
                    : [];
                world.emit("interaction", { actor, targetId, action: "openChest", loot: lootTableId, items: droppedIds });
            }
            break;

        case "readText":
            world.emit("interaction", { actor, targetId, action: "readText", textId: inter.params?.textId });
            break;

        case "descendStair":
        case "ascendStair":
            world.emit?.("stair:traverse", {
                actor, targetId,
                direction: inter.action === "descendStair" ? "down" : "up",
            });
            break;
    }
    return true;
}

// Per-tick system: consumes InteractIntent and dispatches to InteractionSystem
export function interactionSystem(world) {
    for (const [actor, intent] of world.query(InteractIntent)) {
        try { InteractionSystem(world, actor, intent.targetId || 0); } catch {}
        try { world.remove(actor, InteractIntent); } catch {}
    }
}
