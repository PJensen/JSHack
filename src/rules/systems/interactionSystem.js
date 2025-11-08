// src/rules/systems/interactionSystem.js
import { Interactable } from "../components/Interactable.js";
import { InteractIntent } from "../components/Intents/InteractIntent.js";
import { DoorState } from "../components/DoorState.js";
import { Collider } from "../components/Collider.js";
import { Position } from "../components/Position.js";
import { getTileMap, setTileOpaque, setTileWalkable } from "../environment/tileMap.js";

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
                const tileMap = getTileMap(world);
                const pos = world.get(targetId, Position);
                if (tileMap && pos) {
                    const tx = Math.round(pos.x);
                    const ty = Math.round(pos.y);
                    setTileWalkable(tileMap, tx, ty, nowOpen);
                    setTileOpaque(tileMap, tx, ty, !nowOpen);
                }
                world.emit?.("interaction", { actor, targetId, action: "toggleDoor", result: nowOpen ? "opened" : "closed" });
            }
            break;

        case "openChest":
            world.emit("interaction", { actor, targetId, action: "openChest", loot: inter.params?.lootTable });
            break;

        case "readText":
            world.emit("interaction", { actor, targetId, action: "readText", textId: inter.params?.textId });
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
