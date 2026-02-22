// src/rules/systems/interactionSystem.js
import { Interactable } from "../components/Interactable.js";
import { InteractIntent } from "../components/Intents/InteractIntent.js";
import { DoorState } from "../components/DoorState.js";
import { Collider } from "../components/Collider.js";
import { ShopInventory } from "../components/ShopInventory.js";
import { Inventory } from "../components/Inventory.js";
import { Position } from "../components/Position.js";
import { HarvestNode } from "../components/HarvestNode.js";
import { Equipment } from "../components/Equipment.js";
import { Vitality } from "../components/Vitality.js";
import { Mana } from "../components/Mana.js";
import { Stamina } from "../components/Stamina.js";
import TombstoneComponent from "../components/Tombstone.js";
import { createFrom } from "../../lib/ecs-js/archetype.js";
import { WildBerries, WildHerbs, ThornPods, VenomFronds, DungeonMushrooms, IronOre, CoalOre, StoneChip } from "../archetypes/Food.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { combatSeed, mulberry32 } from "../utils/rng.js";
import { spawnHazard } from "../utils/hazardSpawn.js";
import { dealDamage } from "../utils/dealDamage.js";
import { brewAtAlchemyBench, emitAlchemyBenchOpen } from "../content/alchemy/benchGame.js";
import { getCatalogItem } from "../data/itemCatalog.js";

// Maps catalog item ids to archetypes for entity creation during harvest.
const CATALOG_ARCHETYPES = {
    "food_wild_berries":   WildBerries,
    "food_wild_herbs":     WildHerbs,
    "food_mushrooms":      DungeonMushrooms,
    "reagent_thorn_pod":   ThornPods,
    "reagent_venom_frond": VenomFronds,
    "ore_iron":            IronOre,
    "ore_coal":            CoalOre,
    "ore_stone":           StoneChip,
};

const HARVEST_SEED_SALT = 0x48415256;

// One-off helper invoked by the per-tick interactionSystem below
export function InteractionSystem(world, actor, targetId, intent = null) {
    const inter = world.get(targetId, Interactable);
    if (!inter) return false;
    const interactionMode = String(intent?.mode || "").toLowerCase();
    const requestedRecipe = String(intent?.recipe || "").toLowerCase();

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

        case "brewAlchemy":
            {
                if (interactionMode !== "brew" || !requestedRecipe) {
                    emitAlchemyBenchOpen(world, actor, targetId);
                    break;
                }
                brewAtAlchemyBench(world, actor, targetId, requestedRecipe);
            }
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

        case "drinkFountain":
            {
                const vit = world.get(actor, Vitality);
                if (!vit) break;
                const fSeed = combatSeed(world.seed, world.step, actor | 0, targetId | 0, 0xF0C5);
                const r = mulberry32(fSeed);
                const roll = r();
                if (roll < 0.50) {
                    // Heal 20-40% max HP
                    const healAmt = Math.max(1, Math.floor(vit.maxHp * (0.2 + r() * 0.2)));
                    const newHp = Math.min(vit.maxHp, vit.hp + healAmt);
                    world.set(actor, Vitality, { maxHp: vit.maxHp, hp: newHp });
                    world.emit?.("fountain:drink", { actor, targetId, effect: "heal", amount: healAmt });
                } else if (roll < 0.75) {
                    // Restore mana
                    const mana = world.get(actor, Mana);
                    if (mana && mana.maxMana > 0) {
                        const amt = Math.max(1, Math.floor(mana.maxMana * 0.3));
                        world.set(actor, Mana, { ...mana, mana: Math.min(mana.maxMana, mana.mana + amt) });
                        world.emit?.("fountain:drink", { actor, targetId, effect: "mana", amount: amt });
                    } else {
                        const healAmt = Math.max(1, Math.floor(vit.maxHp * 0.15));
                        const newHp = Math.min(vit.maxHp, vit.hp + healAmt);
                        world.set(actor, Vitality, { maxHp: vit.maxHp, hp: newHp });
                        world.emit?.("fountain:drink", { actor, targetId, effect: "heal", amount: healAmt });
                    }
                } else if (roll < 0.90) {
                    world.emit?.("fountain:drink", { actor, targetId, effect: "nothing", amount: 0 });
                } else {
                    // Poison
                    const dmgAmt = Math.max(1, Math.floor(vit.maxHp * (0.05 + r() * 0.05)));
                    dealDamage(world, {
                        target: actor,
                        amount: dmgAmt,
                        type: "poison",
                        source: targetId,
                        cause: "fountain",
                    });
                    world.emit?.("fountain:drink", { actor, targetId, effect: "poison", amount: dmgAmt });
                }
            }
            break;

        case "prayAltar":
            {
                const inv = world.get(actor, Inventory);
                const offerableItems = [];
                if (inv && Array.isArray(inv.items)) {
                    for (const iid of inv.items) {
                        if (!world.isAlive(iid)) continue;
                        const info = world.get(iid, ItemInfo);
                        if (!info) continue;
                        // Currency (gold) and food/equipment/potions can all be offered
                        offerableItems.push(iid);
                    }
                }
                world.emit?.("altar:offerPrompt", { actor, targetId, items: offerableItems });
                // Also pray as before
                world.emit?.("prayer", { actor, distress: null, altarBonus: true });
                world.emit?.("altar:pray", { actor, targetId });
            }
            break;

        case "touchShrine":
            {
                world.emit?.("shrine:touch", { actor, targetId });
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

                // Tool + stamina gate (data-driven: node.requiresTool matches equipment bonus key)
                if (node.requiresTool) {
                    const eq = world.get(actor, Equipment);
                    const weaponId = eq?.weapon || 0;
                    const wInfo = weaponId ? world.get(weaponId, ItemInfo) : null;
                    if (!wInfo?.bonuses?.[node.requiresTool]) {
                        world.emit?.("harvest:no_tool", { actor, targetId, kind: node.kind, requiredTool: node.requiresTool });
                        break;
                    }
                    const stam = world.get(actor, Stamina);
                    const cost = Number(wInfo.staminaCost ?? 25);
                    if (stam && Number(stam.stamina ?? 0) < cost) {
                        world.emit?.("harvest:no_stamina", { actor, targetId, kind: node.kind, cost });
                        break;
                    }
                    if (stam) stam.stamina = Math.max(0, Number(stam.stamina) - cost);
                }

                const r = mulberry32(combatSeed(world.seed, world.step, actor | 0, targetId | 0, HARVEST_SEED_SALT));
                const spread = Math.max(1, (node.yieldMax - node.yieldMin + 1) | 0);
                const count = Math.max(1, (node.yieldMin + ((r() * spread) | 0)) | 0);

                // Yield item — weight-gated, drops at feet if inventory is full/over limit
                let resultItemId = 0;
                const catalogId = node.yield;
                const arch = catalogId ? CATALOG_ARCHETYPES[catalogId] : null;
                if (arch) {
                    const def = getCatalogItem(catalogId);
                    const inv = world.get(actor, Inventory);
                    const actorPos = world.get(actor, Position);

                    // Weight gate using catalog data (before entity creation)
                    let overweight = false;
                    if (inv?.weightLimit != null) {
                        const addWeight = (def?.weight || 0) * count;
                        let curWeight = 0;
                        for (const iid of inv.items) {
                            const ii = world.get(iid, ItemInfo);
                            if (ii) curWeight += (ii.weight || 0) * (ii.count || 1);
                        }
                        overweight = curWeight + addWeight > inv.weightLimit;
                    }
                    const overCapacity = inv != null && inv.capacity != null && inv.items.length >= inv.capacity;

                    const itemId = createFrom(world, arch, {});
                    world.mutate(itemId, ItemInfo, (rec) => { rec.count = count; });
                    resultItemId = itemId;

                    if (inv && !overweight && !overCapacity) {
                        // Components are deferred during tick, so addItemEntityToInventory
                        // can't see ItemInfo yet. Insert directly; coalesceInventoryStacks
                        // handles stacking on the next UI refresh.
                        if (!inv.items.includes(itemId)) inv.items.push(itemId);
                    } else {
                        if (actorPos) world.add(itemId, Position, { x: actorPos.x, y: actorPos.y });
                        if (inv) world.emit?.("harvest:overweight", { actor, targetId, kind: node.kind, count, reason: overweight ? "weight" : "capacity" });
                    }
                }

                // Danger side-effects (data-driven: node.danger / node.hazard)
                const actorPos = world.get(actor, Position);
                if (node.danger) {
                    const dmg = node.danger.dmgMin + ((r() * (node.danger.dmgMax - node.danger.dmgMin + 1)) | 0);
                    const hit = dealDamage(world, {
                        target: actor,
                        amount: dmg,
                        type: node.danger.type || "physical",
                        source: targetId,
                        cause: node.danger.cause || node.kind,
                        at: actorPos ? { x: actorPos.x, y: actorPos.y } : undefined,
                    });
                    world.emit?.("harvest:danger", { actor, targetId, kind: node.kind, effect: node.danger.type, damage: hit.applied ? hit.amount : 0 });
                }
                if (node.hazard) {
                    const hazardAt = actorPos || world.get(targetId, Position);
                    let hazardId = 0;
                    if (hazardAt) {
                        hazardId = spawnHazard(world, {
                            x: hazardAt.x,
                            y: hazardAt.y,
                            kind: node.hazard.kind,
                            medium: "floor",
                            turnsLeft: node.hazard.turnsLeft ?? 2,
                            radius: 0,
                            tickDamage: node.hazard.tickDamage ?? 1,
                            damageType: node.hazard.kind,
                            cause: node.kind,
                            sourceId: targetId,
                            sourceKind: node.kind,
                            identity: node.hazard.identity || node.hazard.kind,
                            name: node.hazard.name || node.hazard.kind,
                            meta: { source: node.kind + "_harvest" },
                        });
                    }
                    world.emit?.("harvest:danger", { actor, targetId, kind: node.kind, effect: "hazard", hazardId });
                }

                world.mutate(targetId, HarvestNode, (n) => { n.ready = false; n.regrowCountdown = n.regrowTurns; });

                world.emit?.("harvest:picked", {
                    actor,
                    targetId,
                    kind: node.kind,
                    count,
                    itemId: resultItemId,
                    regrowTurns: node.regrowTurns,
                });
            }
            break;
    }
    return true;
}

// Per-tick system: consumes InteractIntent and dispatches to InteractionSystem
export function interactionSystem(world) {
    for (const [actor, intent] of world.query(InteractIntent)) {
        try { InteractionSystem(world, actor, intent.targetId || 0, intent); } catch (e) { console.error('[interactionSystem] InteractionSystem failed:', e); }
        try { world.remove(actor, InteractIntent); } catch {} // ECS: may not exist
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
    try { InteractionSystem(world, actor, target); } catch (e) { console.error('[interactionSystem] bump InteractionSystem failed:', e); }
  });
}
