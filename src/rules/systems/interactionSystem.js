// src/rules/systems/InteractionSystem.js
import { Interactable } from "../components/Interactable.js";

export function InteractionSystem(world, actor, targetId) {
    const inter = world.get(targetId, Interactable);
    if (!inter) return false;

    switch (inter.action) {
        case "toggleDoor":
            world.emit("interaction", { actor, targetId, action: "toggleDoor" });
            // actual door logic handled by a DoorSystem or rule function
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
