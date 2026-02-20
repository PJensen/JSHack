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
import { NamedIdentity } from "../components/NamedIdentity.js";
import TombstoneComponent from "../components/Tombstone.js";
import { createFrom } from "../../lib/ecs-js/archetype.js";
import { WildBerries, WildHerbs } from "../archetypes/Food.js";
import { HealthPotion } from "../archetypes/Items.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { buildCatalogItem } from "../data/itemCatalogLoader.js";
import { combatSeed, mulberry32 } from "../utils/rng.js";
import { spawnHazard } from "../utils/hazardSpawn.js";
import { dealDamage } from "../utils/dealDamage.js";

const BERRY_IDENTITY = "food_wild_berries";
const HERB_IDENTITY = "food_wild_herbs";
const HARVEST_SEED_SALT = 0x48415256;

const ALCHEMY_RECIPES = Object.freeze([
  Object.freeze({
    key: "vital_tonic",
    label: "Vital Tonic",
    outputIdentity: "potion_health",
    outputName: "Health Potion",
    berries: 2,
    herbs: 1,
    flavor: "A bright tonic that closes wounds.",
  }),
  Object.freeze({
    key: "venom_draft",
    label: "Venom Draft",
    outputIdentity: "potion_poison",
    outputName: "Potion of Poison",
    berries: 1,
    herbs: 2,
    flavor: "A bitter poison perfect for coating blades.",
  }),
  Object.freeze({
    key: "caustic_venom",
    label: "Caustic Venom",
    outputIdentity: "potion_poison",
    outputName: "Potion of Poison",
    outputCount: 2,
    berries: 2,
    herbs: 3,
    flavor: "A hotter batch that often yields two vials.",
  }),
  Object.freeze({
    key: "stone_skin_tincture",
    label: "Stone Skin Tincture",
    outputIdentity: "potion_stoneskin",
    outputName: "Potion of Stoneskin",
    berries: 2,
    herbs: 3,
    flavor: "Granular suspension that hardens flesh and gear.",
  }),
]);

function findAlchemyRecipe(key) {
  const recipeKey = String(key || "").toLowerCase();
  if (!recipeKey) return null;
  for (const recipe of ALCHEMY_RECIPES) {
    if (recipe.key === recipeKey) return recipe;
  }
  return null;
}

function countInventoryIdentity(world, inv, identity) {
  if (!inv || !Array.isArray(inv.items) || !identity) return 0;
  let total = 0;
  for (const itemId of inv.items) {
    if (!(itemId > 0) || !world.isAlive(itemId)) continue;
    const ni = world.get(itemId, NamedIdentity);
    if (!ni || ni.identity !== identity) continue;
    const info = world.get(itemId, ItemInfo);
    total += Math.max(1, Number(info?.count || 1) | 0);
  }
  return total | 0;
}

function consumeInventoryIdentity(world, inv, identity, amount) {
  if (!inv || !Array.isArray(inv.items)) return false;
  let remaining = Math.max(0, Number(amount || 0) | 0);
  if (remaining <= 0) return true;

  for (let i = 0; i < inv.items.length && remaining > 0; i++) {
    const itemId = Number(inv.items[i] || 0) | 0;
    if (!(itemId > 0) || !world.isAlive(itemId)) continue;
    const ni = world.get(itemId, NamedIdentity);
    if (!ni || ni.identity !== identity) continue;
    const info = world.get(itemId, ItemInfo);
    const stackCount = Math.max(1, Number(info?.count || 1) | 0);
    if (stackCount <= remaining) {
      remaining -= stackCount;
      inv.items.splice(i, 1);
      i -= 1;
      try { world.destroy(itemId); } catch {}
      continue;
    }
    const nextCount = Math.max(0, stackCount - remaining);
    remaining = 0;
    world.mutate(itemId, ItemInfo, (rec) => { rec.count = nextCount; });
  }

  return remaining <= 0;
}

function buildAlchemyProduct(world, recipe) {
  if (!recipe) return 0;
  if (recipe.outputIdentity === "potion_health") {
    return createFrom(world, HealthPotion, {});
  }
  try {
    return buildCatalogItem(world, recipe.outputIdentity, { count: 1 });
  } catch {
    return 0;
  }
}

function emitAlchemyOpen(world, actor, targetId, inv) {
  const berries = countInventoryIdentity(world, inv, BERRY_IDENTITY);
  const herbs = countInventoryIdentity(world, inv, HERB_IDENTITY);
  const recipes = ALCHEMY_RECIPES.map((recipe) => ({
    key: recipe.key,
    label: recipe.label,
    outputName: recipe.outputName,
    outputIdentity: recipe.outputIdentity,
    outputCount: Math.max(1, Number(recipe.outputCount || 1) | 0),
    berries: recipe.berries,
    herbs: recipe.herbs,
    canCraft: berries >= recipe.berries && herbs >= recipe.herbs,
    flavor: recipe.flavor,
  }));
  world.emit?.("alchemy:open", {
    actor,
    targetId,
    ingredients: { berries, herbs },
    recipes,
  });
}

function craftAtBench(world, actor, targetId, recipeKey) {
  const inv = world.get(actor, Inventory);
  if (!inv) {
    world.emit?.("alchemy:result", {
      actor,
      targetId,
      result: "no_inventory",
      recipeKey: String(recipeKey || ""),
    });
    return;
  }

  const recipe = findAlchemyRecipe(recipeKey);
  if (!recipe) {
    emitAlchemyOpen(world, actor, targetId, inv);
    world.emit?.("alchemy:result", {
      actor,
      targetId,
      result: "unknown_recipe",
      recipeKey: String(recipeKey || ""),
    });
    return;
  }

  const haveBerries = countInventoryIdentity(world, inv, BERRY_IDENTITY);
  const haveHerbs = countInventoryIdentity(world, inv, HERB_IDENTITY);
  const missingBerries = Math.max(0, recipe.berries - haveBerries);
  const missingHerbs = Math.max(0, recipe.herbs - haveHerbs);
  if (missingBerries > 0 || missingHerbs > 0) {
    emitAlchemyOpen(world, actor, targetId, inv);
    world.emit?.("alchemy:result", {
      actor,
      targetId,
      result: "missing_ingredients",
      recipeKey: recipe.key,
      missing: { berries: missingBerries, herbs: missingHerbs },
      have: { berries: haveBerries, herbs: haveHerbs },
      need: { berries: recipe.berries, herbs: recipe.herbs },
    });
    return;
  }

  if (!consumeInventoryIdentity(world, inv, BERRY_IDENTITY, recipe.berries)) {
    world.emit?.("alchemy:result", { actor, targetId, result: "consume_failed", recipeKey: recipe.key });
    return;
  }
  if (!consumeInventoryIdentity(world, inv, HERB_IDENTITY, recipe.herbs)) {
    world.emit?.("alchemy:result", { actor, targetId, result: "consume_failed", recipeKey: recipe.key });
    return;
  }

  const outCount = Math.max(1, Number(recipe.outputCount || 1) | 0);
  const craftedItemIds = [];
  for (let i = 0; i < outCount; i++) {
    const itemId = buildAlchemyProduct(world, recipe);
    if (!(itemId > 0)) continue;
    craftedItemIds.push(itemId);
    if (!inv.items.includes(itemId)) inv.items.push(itemId);
  }
  if (!craftedItemIds.length) {
    world.emit?.("alchemy:result", { actor, targetId, result: "brew_failed", recipeKey: recipe.key });
    return;
  }

  world.emit?.("alchemy:crafted", {
    actor,
    targetId,
    recipeKey: recipe.key,
    recipeLabel: recipe.label,
    outputIdentity: recipe.outputIdentity,
    outputName: recipe.outputName,
    outputCount: craftedItemIds.length,
    itemIds: craftedItemIds.slice(),
    cost: { berries: recipe.berries, herbs: recipe.herbs },
  });
  emitAlchemyOpen(world, actor, targetId, inv);
}

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
                    emitAlchemyOpen(world, actor, targetId, world.get(actor, Inventory));
                    break;
                }
                craftAtBench(world, actor, targetId, requestedRecipe);
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

                const r = mulberry32(combatSeed(world.seed, world.step, actor | 0, targetId | 0, HARVEST_SEED_SALT));
                const kind = String(node.kind || "berries").toLowerCase();
                const isHerbNode = (kind === "herbs" || kind === "venom_fern");
                const minCount = (kind === "venom_fern" || kind === "thorn_bramble") ? 2 : 1;
                const maxCount = kind === "herbs"
                    ? 2
                    : (kind === "venom_fern"
                        ? 3
                        : (kind === "thorn_bramble" ? 4 : 3));
                const spread = Math.max(1, (maxCount - minCount + 1) | 0);
                const baseCount = minCount + ((r() * spread) | 0);
                const count = Math.max(1, baseCount | 0);
                const itemId = createFrom(world, isHerbNode ? WildHerbs : WildBerries, {});
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

                const actorPos = world.get(actor, Position);
                if (kind === "thorn_bramble") {
                    const thornDmg = 1 + ((r() * 3) | 0);
                    const hit = dealDamage(world, {
                        target: actor,
                        amount: thornDmg,
                        type: "physical",
                        source: targetId,
                        cause: "thorn_bramble",
                        at: actorPos ? { x: actorPos.x, y: actorPos.y } : undefined,
                    });
                    if (hit.applied) {
                        world.emit?.("harvest:danger", {
                            actor,
                            targetId,
                            kind,
                            effect: "thorns",
                            damage: hit.amount,
                        });
                    }
                } else if (kind === "venom_fern") {
                    const poisonDmg = 1 + ((r() * 2) | 0);
                    const hit = dealDamage(world, {
                        target: actor,
                        amount: poisonDmg,
                        type: "poison",
                        source: targetId,
                        cause: "venom_fern",
                        at: actorPos ? { x: actorPos.x, y: actorPos.y } : undefined,
                    });
                    const hazardAt = actorPos || world.get(targetId, Position);
                    let hazardId = 0;
                    if (hazardAt) {
                        hazardId = spawnHazard(world, {
                            x: hazardAt.x,
                            y: hazardAt.y,
                            kind: "poison",
                            medium: "floor",
                            turnsLeft: 2,
                            radius: 0,
                            tickDamage: 1,
                            damageType: "poison",
                            cause: "venom_fern",
                            sourceId: targetId,
                            sourceKind: "venom_fern",
                            identity: "venom_spores",
                            name: "Venom Spores",
                            meta: { source: "venom_fern_harvest" },
                        });
                    }
                    world.emit?.("harvest:danger", {
                        actor,
                        targetId,
                        kind,
                        effect: "spores",
                        damage: hit.applied ? hit.amount : 0,
                        hazardId,
                    });
                }

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
    }
    return true;
}

// Per-tick system: consumes InteractIntent and dispatches to InteractionSystem
export function interactionSystem(world) {
    for (const [actor, intent] of world.query(InteractIntent)) {
        try { InteractionSystem(world, actor, intent.targetId || 0, intent); } catch {}
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
