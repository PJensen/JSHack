// src/rules/systems/interactionSystem.js
import { Interactable } from "../components/Interactable.js";
import { InteractIntent } from "../components/Intents/InteractIntent.js";
import { DoorState } from "../components/DoorState.js";
import { Collider } from "../components/Collider.js";
import { ShopInventory } from "../components/ShopInventory.js";
import { Inventory } from "../components/Inventory.js";
import { Position } from "../components/Position.js";
import { HarvestNode } from "../components/HarvestNode.js";
import { Vitality } from "../components/Vitality.js";
import { Mana } from "../components/Mana.js";
import { Stamina } from "../components/Stamina.js";
import TombstoneComponent from "../components/Tombstone.js";
import { DungeonState } from "../components/DungeonState.js";
import { createFrom } from "../../lib/ecs-js/archetype.js";
import { WildBerries, WildHerbs } from "../archetypes/Food.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { combatSeed, mulberry32 } from "../utils/rng.js";
import { transitionToDepth } from "../environment/dungeon/transition.js";
import { resolveTeleportDestination } from "../utils/teleport.js";

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

        case "restAtBed":
            {
                const vit = world.get(actor, Vitality);
                if (vit) {
                    world.set(actor, Vitality, { maxHp: vit.maxHp, hp: vit.maxHp });
                }
                const mana = world.get(actor, Mana);
                if (mana) {
                    world.set(actor, Mana, { ...mana, mana: mana.maxMana });
                }
                const stamina = world.get(actor, Stamina);
                if (stamina) {
                    world.set(actor, Stamina, { ...stamina, stamina: stamina.maxStamina, regenCooldown: 0 });
                }
                world.emit?.("bed:rested", { actor, targetId });
            }
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
            // Stair traversal is app-owned (tooltip tap / Enter), not rules-interaction driven.
            break;

        case "readTombstone":
            {
                const tombstone = world.get(targetId, TombstoneComponent);
                if (tombstone) {
                    world.emit?.("interaction", {
                        actor,
                        targetId,
                        action: "readTombstone",
                        epitaph: tombstone.epitaph,
                        tombstoneData: {
                            playerName: tombstone.playerName,
                            depth: tombstone.depth,
                            cause: tombstone.cause,
                            killerName: tombstone.killerName,
                        }
                    });
                }
            }
            break;

        case "harvestNode":
            {
                const node = world.get(targetId, HarvestNode);
                if (!node) break;

                if (!node.ready) {
                    world.emit?.("harvest:empty", {
                        actor,
                        targetId,
                        kind: node.kind,
                        regrowCountdown: node.regrowCountdown | 0,
                    });
                    break;
                }

                const r = mulberry32(combatSeed(world.seed, world.step, actor | 0, targetId | 0, 0x48415256));
                const kind = String(node.kind || "berries");
                const baseCount = kind === "herbs" ? (1 + ((r() * 2) | 0)) : (1 + ((r() * 3) | 0));
                const count = Math.max(1, baseCount | 0);
                const itemId = createFrom(world, kind === "herbs" ? WildHerbs : WildBerries, {});
                world.mutate(itemId, ItemInfo, (rec) => { rec.count = count; });

                let resultItemId = itemId;
                const inv = world.get(actor, Inventory);
                if (inv) {
                    // Components are deferred during tick, so
                    // addItemEntityToInventory can't see ItemInfo yet.
                    // Insert directly; coalesceInventoryStacks handles
                    // stacking on the next UI refresh.
                    if (!inv.items.includes(itemId)) inv.items.push(itemId);
                } else {
                    const pos = world.get(actor, Position);
                    if (pos) world.add(itemId, Position, { x: pos.x, y: pos.y });
                }

                world.set(targetId, HarvestNode, {
                    kind,
                    ready: false,
                    regrowTurns: node.regrowTurns,
                    regrowCountdown: node.regrowTurns,
                });
                world.emit?.("harvest:picked", {
                    actor,
                    targetId,
                    kind,
                    count,
                    itemId: resultItemId,
                    regrowTurns: node.regrowTurns,
                });
            }
            break;

        case "useReturnPortal":
            {
                let ds = null;
                for (const [, state] of world.query(DungeonState)) { ds = state; break; }
                const rp = ds?.returnPortal;
                const fromDepth = Number(rp?.fromDepth ?? inter.params?.fromDepth);
                const fromPos = rp?.fromPos || inter.params?.fromPos;
                if (!Number.isInteger(fromDepth) || !fromPos || !Number.isInteger(fromPos.x) || !Number.isInteger(fromPos.y)) {
                    world.emit?.("portal:failed", { actor, targetId, reason: "invalid-anchor" });
                    break;
                }

                transitionToDepth(world, fromDepth, { x: fromPos.x, y: fromPos.y }, { skipPostTick: true });

                const fallback = resolveTeleportDestination(world, { x: fromPos.x, y: fromPos.y }, {
                    maxDistance: 3,
                    exclude: [{ x: fromPos.x, y: fromPos.y }],
                }) || { x: fromPos.x, y: fromPos.y };

                world.set(actor, Position, fallback);
                if (ds) ds.returnPortal = null;
                try { world.destroy(targetId); } catch {}
                world.emit?.("portal:returned", { actor, targetId, to: { depth: fromDepth, pos: fallback } });
            }
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
