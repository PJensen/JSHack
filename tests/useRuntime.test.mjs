import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createPlayer } from "../src/rules/archetypes/Player.js";
import { createCorpse } from "../src/rules/archetypes/Food.js";
import { buildCatalogItem } from "../src/rules/data/itemCatalogLoader.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { UseIntent } from "../src/rules/components/Intents/UseIntent.js";
import { useItemSystem } from "../src/rules/systems/useItemSystem.js";
import "../src/rules/scripts/consumables.js";

Deno.test("use runtime resolves wand payload object and consumes one charge", () => {
  const world = new World({ seed: 3301 });
  const actor = createPlayer(world, { x: 0, y: 0, name: "Caster" });
  const inv = world.get(actor, Inventory);
  const wand = buildCatalogItem(world, "wand_lightning");
  inv.items.push(wand);

  const results = [];
  world.on("interaction:result", (ev) => results.push(ev));

  world.add(actor, UseIntent, { itemId: wand, targetId: actor });
  useItemSystem(world);

  assertEquals(results.length, 1);
  assertEquals(results[0].verb, "use");
  assertEquals(results[0].ok, true);
  assertEquals(results[0].metrics.path, "matcher");
  assertEquals(results[0].metrics.payloadMatched, true);

  const info = world.get(wand, ItemInfo);
  assert(info && Number(info.count) === 2, "wand should lose one charge");
});

Deno.test("use runtime resolves corpse consumable payload object and can cancel", () => {
  const world = new World({ seed: 3302 });
  const actor = createPlayer(world, { x: 0, y: 0, name: "Hero" });
  const inv = world.get(actor, Inventory);

  const corpse = createCorpse(world, {
    id: "test_cancel",
    name: "Cursed Meal",
    sizeClass: "S",
    massKg: 5,
    tier: 0,
  }, { x: 0, y: 0 });
  inv.items.push(corpse);

  const results = [];
  world.on("interaction:result", (ev) => results.push(ev));

  world.add(actor, UseIntent, { itemId: corpse, targetId: actor });
  useItemSystem(world);

  assertEquals(results.length, 1);
  assertEquals(results[0].verb, "use");
  assertEquals(results[0].metrics.path, "effect");
  assertEquals(results[0].metrics.payloadMatched, true);
  assertEquals(results[0].canceled, true, "cursed meal should cancel through payload script");
});
