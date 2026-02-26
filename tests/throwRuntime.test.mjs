import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { buildCatalogItem } from "../src/rules/data/itemCatalogLoader.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { Faction } from "../src/rules/components/Faction.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Position } from "../src/rules/components/Position.js";
import { ScriptRef } from "../src/rules/components/ScriptRef.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { ThrowIntent } from "../src/rules/components/Intents/ThrowIntent.js";
import { ScriptVerb, registerScript } from "../src/rules/scripting.js";
import { throwSystem } from "../src/rules/systems/throwSystem.js";

Deno.test("throw runtime default path drops item to landing tile with weighted range", () => {
  const world = new World({ seed: 7101 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], maxWeight: 999 });
  world.add(actor, Position, { x: 10, y: 10 });

  const scroll = buildCatalogItem(world, "scroll_mapping");
  world.get(actor, Inventory).items.push(scroll);

  const thrownEvents = [];
  const results = [];
  world.on("item:thrown", (ev) => thrownEvents.push(ev));
  world.on("interaction:result", (ev) => results.push(ev));

  world.add(actor, ThrowIntent, { itemId: scroll, x: 99, y: 10 });
  throwSystem(world);

  assertEquals(results.length, 1);
  assertEquals(results[0].verb, "throw");
  assertEquals(results[0].ok, true);
  assertEquals(results[0].metrics.path, "none");
  assertEquals(results[0].metrics.dropped, true);
  assertEquals(results[0].metrics.consumed, false);
  assertEquals(thrownEvents.length, 1);

  const throwMeta = results[0].payload?.throw;
  assert(throwMeta && Number.isFinite(throwMeta.range), "throw payload should include resolved throw metadata");
  assert(throwMeta.range >= 1, "throw range should be at least one tile");

  const inv = world.get(actor, Inventory);
  assert(!inv.items.includes(scroll), "base throw should remove item from inventory");
  const groundPos = world.get(scroll, Position);
  assert(groundPos, "base throw should place the item on the ground");

  assertEquals(groundPos.x, thrownEvents[0].to.x);
  assertEquals(groundPos.y, thrownEvents[0].to.y);
  assertEquals(thrownEvents[0].range, throwMeta.range);
});

Deno.test("throw runtime range decreases with heavier item weight", () => {
  const world = new World({ seed: 7102 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], maxWeight: 999 });
  world.add(actor, Position, { x: 0, y: 0 });

  const light = buildCatalogItem(world, "scroll_mapping"); // explicit weight 0.1
  const heavy = buildCatalogItem(world, "stone_touchstone"); // explicit weight 10
  const inv = world.get(actor, Inventory);
  inv.items.push(light, heavy);

  const results = [];
  world.on("interaction:result", (ev) => results.push(ev));

  world.add(actor, ThrowIntent, { itemId: light, x: 20, y: 0 });
  throwSystem(world);
  world.add(actor, ThrowIntent, { itemId: heavy, x: 20, y: 0 });
  throwSystem(world);

  assertEquals(results.length, 2);
  const lightThrow = results[0].payload?.throw;
  const heavyThrow = results[1].payload?.throw;
  assert(lightThrow && heavyThrow, "both throw actions should expose throw metadata");
  assert(lightThrow.maxRange > heavyThrow.maxRange, "lighter items should throw farther than heavier items");
});

Deno.test("throw runtime weapon impacts hostile entity on landing tile", () => {
  const world = new World({ seed: 7104 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], maxWeight: 999 });
  world.add(actor, Position, { x: 10, y: 10 });
  world.add(actor, Faction, { key: "player" });

  const target = world.create();
  world.add(target, Position, { x: 12, y: 10 });
  world.add(target, Vitality, { hp: 12, maxHp: 12 });
  world.add(target, Faction, { key: "enemy" });

  const dagger = buildCatalogItem(world, "dagger_quick");
  world.get(actor, Inventory).items.push(dagger);

  const impacts = [];
  const results = [];
  world.on("item:throw-impact", (ev) => impacts.push(ev));
  world.on("interaction:result", (ev) => results.push(ev));

  world.add(actor, ThrowIntent, { itemId: dagger, x: 12, y: 10 });
  throwSystem(world);

  assertEquals(results.length, 1);
  assertEquals(results[0].verb, "throw");
  assertEquals(results[0].ok, true);
  assertEquals(results[0].metrics.impacted, true);
  assert(results[0].metrics.impactDamage > 0, "impact damage should be recorded");

  assertEquals(impacts.length, 1);
  assertEquals(impacts[0].actor, actor);
  assertEquals(impacts[0].itemId, dagger);
  assertEquals(impacts[0].targetId, target);
  assert(impacts[0].damage > 0, "impact event should include positive damage");

  const vit = world.get(target, Vitality);
  assert(vit.hp < 12, "thrown weapon should reduce target hp");
});

Deno.test("throw runtime invokes ScriptVerb.ItemThrow with throw context", () => {
  const world = new World({ seed: 7103 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], maxWeight: 999 });
  world.add(actor, Position, { x: 4, y: 4 });

  const item = world.create();
  world.add(item, NamedIdentity, { name: "Scripted Rock", identity: "scripted_rock" });
  world.add(item, ItemInfo, {
    type: "tool",
    slot: "bag",
    weight: 2,
    value: 0,
    description: "A rock that runs scripts when thrown.",
    count: 1,
    bonuses: {},
    rarity: 1,
    rarityName: "common",
    affixes: [],
  });
  world.add(item, ScriptRef, { ref: "test:throw_runtime_script", params: { flag: "ok" } });
  world.get(actor, Inventory).items.push(item);

  let seen = null;
  registerScript("test:throw_runtime_script", {
    [ScriptVerb.ItemThrow]: (_world, ctx) => {
      seen = ctx;
      return { skipBaseThrow: true };
    },
  });

  const results = [];
  world.on("interaction:result", (ev) => results.push(ev));

  world.add(actor, ThrowIntent, { itemId: item, x: 9, y: 4 });
  throwSystem(world);

  assertEquals(results.length, 1);
  assertEquals(results[0].verb, "throw");
  assert(seen && typeof seen === "object", "throw script callback should be invoked");
  assertEquals(seen.actor, actor);
  assertEquals(seen.itemId, item);
  assertEquals(seen.params?.flag, "ok");
  assert(Number.isFinite(seen.throw?.range), "throw context should include resolved range");
  assertEquals(seen.targetX, 8, "targetX should carry resolved landing tile");
  assertEquals(seen.targetY, 4, "targetY should carry resolved landing tile");

  const inv = world.get(actor, Inventory);
  assert(inv.items.includes(item), "skipBaseThrow should leave the item in inventory");
  assert(!world.has(item, Position), "skipBaseThrow should avoid ground placement");
});
