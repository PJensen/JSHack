// src/rules/systems/interactionSystem.js
import { Interactable } from "../components/Interactable.js";
import { InteractIntent } from "../components/Intents/InteractIntent.js";
import { DoorState } from "../components/DoorState.js";
import { Collider } from "../components/Collider.js";
import { ShopInventory } from "../components/ShopInventory.js";
import { Inventory } from "../components/Inventory.js";

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
                const inv = world.get(targetId, Inventory);
                if (inv) {
                    world.emit?.("chest:open", {
                        actor,
                        targetId,
                        chestItems: [...(inv.items || [])],
                    });
                }
            }
            break;

        case "readText":
            world.emit("interaction", { actor, targetId, action: "readText", textId: inter.params?.textId });
            break;

        case "openShop":
            {
                const shop = world.get(targetId, ShopInventory);
                if (shop) {
                    world.emit?.("shop:open", {
                        actor, targetId,
                        shopItems: [...(shop.items || [])],
                        buyMarkup: shop.buyMarkup ?? 1.0,
                        sellDiscount: shop.sellDiscount ?? 0.5,
                    });
                }
            }
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

// --- Bump-interact event listener ----------------------------------------

const BUMP_INTERACT_INSTALLED = Symbol.for("jshack.bumpInteract");

/**
 * Install a world.on('bump:interact') listener for immediate interactions
 * triggered by movement (e.g., bumping doors/chests/NPCs).
 * This avoids the deferred-add problem where InteractIntent wouldn't be
 * visible until next tick.
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function installBumpInteractListener(world) {
  if (!world || world[BUMP_INTERACT_INSTALLED]) return;
  world[BUMP_INTERACT_INSTALLED] = true;

  world.on("bump:interact", ({ actor, target }) => {
    try { InteractionSystem(world, actor, target); } catch {}
  });
}
