import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { ApplyIntent } from "../src/rules/components/Intents/ApplyIntent.js";
import { DrinkIntent } from "../src/rules/components/Intents/DrinkIntent.js";
import { UseIntent } from "../src/rules/components/Intents/UseIntent.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { Material } from "../src/rules/components/Material.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Position } from "../src/rules/components/Position.js";
import { applySystem } from "../src/rules/systems/applySystem.js";
import { drinkSystem } from "../src/rules/systems/drinkSystem.js";
import { useItemSystem } from "../src/rules/systems/useItemSystem.js";
import { createItemById } from "../src/rules/utils/itemFactory.js";

Deno.test("stoneskin potion on_drink grants temporary stoneskin effect", () => {
  const world = new World({ seed: 6101 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], maxWeight: 100 });
  world.add(actor, Position, { x: 5, y: 5 });

  const potion = createItemById(world, "potion_stoneskin");
  assert(potion != null, "stoneskin potion should be creatable");
  world.get(actor, Inventory).items.push(potion);

  const results = [];
  world.on("interaction:result", (ev) => results.push(ev));

  world.add(actor, DrinkIntent, { itemId: potion, targetId: actor });
  drinkSystem(world);

  assertEquals(results.length, 1);
  assertEquals(results[0].verb, "drink");
  assertEquals(results[0].ok, true);
  assert(results[0].payload?.onDrink?.potency >= 2, "onDrink payload should expose potency");
  assert(!world.isAlive(potion), "drinking should consume the potion");

  const effects = world.get(actor, ActiveEffects);
  assert(Array.isArray(effects?.effects), "actor should have active effects");
  const stoneskin = effects.effects.find((e) => e.key === "stoneskin");
  assert(stoneskin, "stoneskin effect should be queued by on_drink");
  assert(stoneskin.turnsLeft >= 10, "stoneskin duration should be in configured range");
});

Deno.test("stoneskin potion on_throw (via use pipeline) spawns taunting statue", () => {
  const world = new World({ seed: 6102 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], maxWeight: 100 });
  world.add(actor, Position, { x: 10, y: 10 });

  const potion = createItemById(world, "potion_stoneskin");
  assert(potion != null, "stoneskin potion should be creatable");
  world.get(actor, Inventory).items.push(potion);

  const messageEvents = [];
  const results = [];
  world.on("message", (ev) => messageEvents.push(ev));
  world.on("interaction:result", (ev) => results.push(ev));

  world.add(actor, UseIntent, { itemId: potion, targetId: actor });
  useItemSystem(world);

  assertEquals(results.length, 1);
  assertEquals(results[0].verb, "use");
  assertEquals(results[0].ok, true);
  assertEquals(results[0].metrics.path, "itemHooks");
  assert(!world.isAlive(potion), "throwing should consume the potion");

  let spawnedTaunter = 0;
  for (const [id, ni] of world.query(NamedIdentity)) {
    if (ni.identity === "stone_taunter") {
      spawnedTaunter = id;
      break;
    }
  }
  assert(spawnedTaunter > 0, "on_throw should spawn a stone_taunter monster");
  assert(messageEvents.some((ev) => String(ev?.text || "").toLowerCase().includes("taunt")), "taunt message should be emitted");
});

Deno.test("stoneskin potion on_dip (via apply pipeline) petrifies target item", () => {
  const world = new World({ seed: 6103 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], maxWeight: 100 });
  const inv = world.get(actor, Inventory);

  const potion = createItemById(world, "potion_stoneskin");
  const weapon = createItemById(world, "dagger_quick");
  assert(potion != null && weapon != null, "required test items should be creatable");
  inv.items.push(potion, weapon);

  const weaponInfoBefore = world.get(weapon, ItemInfo);
  const beforeDefense = Number(weaponInfoBefore?.bonuses?.defense || 0);

  const results = [];
  world.on("interaction:result", (ev) => results.push(ev));

  world.add(actor, ApplyIntent, { itemId: potion, targetItemId: weapon });
  applySystem(world);

  assertEquals(results.length, 1);
  assertEquals(results[0].verb, "apply");
  assertEquals(results[0].ok, true);
  assertEquals(results[0].metrics.path, "payload");
  assertEquals(results[0].metrics.consumedTool, true);
  assert(!world.isAlive(potion), "dipping should consume stoneskin potion");

  const weaponInfoAfter = world.get(weapon, ItemInfo);
  const afterDefense = Number(weaponInfoAfter?.bonuses?.defense || 0);
  assertEquals(afterDefense, beforeDefense + 1);

  const mat = world.get(weapon, Material);
  assertEquals(String(mat?.kind || ""), "stone");
});
