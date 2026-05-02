import "./helpers/installContentCatalog.mjs";
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createFrom } from "../src/lib/ecs-js/archetype.js";
import { buildCatalogItem } from "../src/rules/data/itemCatalogLoader.js";
import { Bone } from "../src/rules/archetypes/Items.js";
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
import { HazardArea } from "../src/rules/components/HazardArea.js";
import { addToInventory, inventoryContains } from "../src/rules/utils/inventoryFacade.js";

Deno.test("throw runtime default path drops item to landing tile with weighted range", () => {
  const world = new World({ seed: 7101 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], maxWeight: 999 });
  world.add(actor, Position, { x: 10, y: 10 });

  const scroll = buildCatalogItem(world, "scroll_mapping");
  addToInventory(world, actor, scroll);

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

  assert(!inventoryContains(world, actor, scroll), "base throw should remove item from inventory");
  const groundPos = world.get(scroll, Position);
  assert(groundPos, "base throw should place the item on the ground");

  assertEquals(groundPos.x, thrownEvents[0].to.x);
  assertEquals(groundPos.y, thrownEvents[0].to.y);
  assertEquals(thrownEvents[0].range, throwMeta.range);
});

Deno.test("throw runtime carries weapon family for thrown weapons and shields", () => {
  const expected = {
    dagger_quick: "dagger",
    shield_iron: "shield_metal",
    shield_wood: "shield_wood",
  };

  for (const [catalogId, family] of Object.entries(expected)) {
    const world = new World({ seed: 7108 });
    const actor = world.create();
    world.add(actor, Inventory, { items: [], maxWeight: 999 });
    world.add(actor, Position, { x: 10, y: 10 });

    const item = buildCatalogItem(world, catalogId);
    addToInventory(world, actor, item);

    const thrownEvents = [];
    world.on("item:thrown", (ev) => thrownEvents.push(ev));

    world.add(actor, ThrowIntent, { itemId: item, x: 12, y: 10 });
    throwSystem(world);

    assertEquals(thrownEvents.length, 1, `${catalogId} should emit item:thrown`);
    assertEquals(thrownEvents[0].itemId, item);
    assertEquals(thrownEvents[0].weaponFamily, family, `${catalogId} should carry weaponFamily`);
  }
});

Deno.test("throw runtime preserves selected off-axis tile when target is in range", () => {
  const world = new World({ seed: 7105 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], maxWeight: 999 });
  world.add(actor, Position, { x: 10, y: 10 });

  const item = buildCatalogItem(world, "scroll_mapping");
  addToInventory(world, actor, item);

  const thrownEvents = [];
  world.on("item:thrown", (ev) => thrownEvents.push(ev));

  world.add(actor, ThrowIntent, { itemId: item, x: 13, y: 11 });
  throwSystem(world);

  assertEquals(thrownEvents.length, 1);
  assertEquals(thrownEvents[0].to.x, 13);
  assertEquals(thrownEvents[0].to.y, 11);
});

Deno.test("throw runtime preserves aim slope when clamping out-of-range targets", () => {
  const world = new World({ seed: 7106 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], maxWeight: 999 });
  world.add(actor, Position, { x: 10, y: 10 });

  const item = world.create();
  world.add(item, NamedIdentity, { name: "Test Stone", identity: "test_stone" });
  world.add(item, ItemInfo, {
    type: "tool",
    slot: "bag",
    weight: 2,
    value: 0,
    description: "Test throw vector item.",
    count: 1,
    bonuses: {},
    rarity: 1,
    rarityName: "common",
    affixes: [],
  });
  addToInventory(world, actor, item);

  const thrownEvents = [];
  world.on("item:thrown", (ev) => thrownEvents.push(ev));

  world.add(actor, ThrowIntent, { itemId: item, x: 20, y: 12 });
  throwSystem(world);

  assertEquals(thrownEvents.length, 1);
  assertEquals(thrownEvents[0].to.x, 14);
  assertEquals(thrownEvents[0].to.y, 11);
});

Deno.test("throw runtime range decreases with heavier item weight", () => {
  const world = new World({ seed: 7102 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], maxWeight: 999 });
  world.add(actor, Position, { x: 0, y: 0 });

  const light = buildCatalogItem(world, "scroll_mapping"); // explicit weight 0.1
  const heavy = buildCatalogItem(world, "stone_touchstone"); // explicit weight 10
  addToInventory(world, actor, light);
  addToInventory(world, actor, heavy);

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
  addToInventory(world, actor, dagger);

  const impacts = [];
  const damaged = [];
  const results = [];
  world.on("item:throw-impact", (ev) => impacts.push(ev));
  world.on("damaged", (ev) => damaged.push(ev));
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
  assert((damaged[0]?.projectileDelay || 0) > 0, "thrown impact damage should carry projectileDelay");

  const vit = world.get(target, Vitality);
  assert(vit.hp < 12, "thrown weapon should reduce target hp");
});

Deno.test("throw runtime bones impact hostile entity on landing tile", () => {
  const world = new World({ seed: 7110 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], maxWeight: 999 });
  world.add(actor, Position, { x: 10, y: 10 });
  world.add(actor, Faction, { key: "player" });

  const target = world.create();
  world.add(target, Position, { x: 12, y: 10 });
  world.add(target, Vitality, { hp: 12, maxHp: 12 });
  world.add(target, Faction, { key: "enemy" });

  const bone = createFrom(world, Bone, {});
  addToInventory(world, actor, bone);

  const impacts = [];
  const damaged = [];
  const results = [];
  world.on("item:throw-impact", (ev) => impacts.push(ev));
  world.on("damaged", (ev) => damaged.push(ev));
  world.on("interaction:result", (ev) => results.push(ev));

  world.add(actor, ThrowIntent, { itemId: bone, x: 12, y: 10 });
  throwSystem(world);

  assertEquals(results.length, 1);
  assertEquals(results[0].verb, "throw");
  assertEquals(results[0].ok, true);
  assertEquals(results[0].metrics.impacted, true);
  assert(results[0].metrics.impactDamage > 0, "bone impact damage should be recorded");

  assertEquals(impacts.length, 1);
  assertEquals(impacts[0].actor, actor);
  assertEquals(impacts[0].itemId, bone);
  assertEquals(impacts[0].targetId, target);
  assert(impacts[0].damage > 0, "bone throw impact event should include positive damage");
  assert((damaged[0]?.projectileDelay || 0) > 0, "thrown bone impact damage should carry projectileDelay");

  const vit = world.get(target, Vitality);
  assert(vit.hp < 12, "thrown bones should reduce target hp");
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
  addToInventory(world, actor, item);

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

  assert(inventoryContains(world, actor, item), "skipBaseThrow should leave the item in inventory");
  assert(!world.has(item, Position), "skipBaseThrow should avoid ground placement");
});

Deno.test("throwing a torch starts a fire and still drops the torch item", () => {
  const world = new World({ seed: 7107 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], maxWeight: 999 });
  world.add(actor, Position, { x: 10, y: 10 });

  const torch = buildCatalogItem(world, "torch");
  addToInventory(world, actor, torch);

  world.add(actor, ThrowIntent, { itemId: torch, x: 12, y: 10 });
  throwSystem(world);

  assert(!inventoryContains(world, actor, torch), "thrown torch should leave inventory");

  const torchPos = world.get(torch, Position);
  assert(torchPos, "torch should land on the ground after the throw");
  assertEquals(torchPos.x, 12);
  assertEquals(torchPos.y, 10);

  const fires = [];
  for (const [id, pos, hazard] of world.query(Position, HazardArea)) {
    if (String(hazard?.kind || "") !== "fire") continue;
    fires.push({ id, pos, hazard });
  }

  assertEquals(fires.length, 1, "throwing a torch should create exactly one fire hazard");
  assertEquals(fires[0].pos.x, 12);
  assertEquals(fires[0].pos.y, 10);
  assertEquals(fires[0].hazard.cause, "torch_fire");
  assertEquals(fires[0].hazard.sourceKind, "torch");
});
