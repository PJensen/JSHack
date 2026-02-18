// @ts-nocheck
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createPlayer } from "../src/rules/archetypes/Player.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { Position } from "../src/rules/components/Position.js";
import { Faction } from "../src/rules/components/Faction.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import { UseIntent } from "../src/rules/components/Intents/UseIntent.js";
import { useItemSystem } from "../src/rules/systems/useItemSystem.js";
import { buildCatalogItem } from "../src/rules/data/itemCatalogLoader.js";
import { createItemById } from "../src/rules/utils/itemFactory.js";

function scheduler(world) {
  useItemSystem(world);
}

Deno.test("wand use resolves from data defs, emits cast, and decrements charges", () => {
  const world = new World({ seed: 101 });
  world.setScheduler((w) => scheduler(w));

  const player = createPlayer(world, { x: 10, y: 10, name: "Caster" });
  const inv = world.get(player, Inventory);
  assert(inv && Array.isArray(inv.items), "player should have inventory");

  const target = world.create();
  world.add(target, Position, { x: 11, y: 10 });
  world.add(target, Faction, { key: "enemy" });
  world.add(target, Vitality, { hp: 20, maxHp: 20 });

  const wand = buildCatalogItem(world, "wand_lightning");
  assert(wand != null, "wand should be creatable");
  inv.items.push(wand);

  const castEvents = [];
  const usedEvents = [];
  world.on("castSpell", (e) => castEvents.push(e));
  world.on("item:used", (e) => usedEvents.push(e));

  world.add(player, UseIntent, { itemId: wand, targetId: target });
  world.tick(1);

  const info = world.get(wand, ItemInfo);
  assert(info, "wand should still exist after one use");
  assertEquals(info.count, 2);
  assert(inv.items.includes(wand), "wand should remain in inventory with remaining charges");
  assertEquals(usedEvents.length, 1);

  const cast = castEvents.find((e) => e.spellId === "lightning");
  assert(cast, "wand use should emit castSpell for lightning");
  assertEquals(cast.source, "wand");
  assertEquals(cast.targetId, target);
});

Deno.test("scroll use resolves from data defs, emits cast, and consumes item", () => {
  const world = new World({ seed: 102 });
  world.setScheduler((w) => scheduler(w));

  const player = createPlayer(world, { x: 5, y: 5, name: "Reader" });
  const inv = world.get(player, Inventory);
  assert(inv && Array.isArray(inv.items), "player should have inventory");

  const scroll = createItemById(world, "scroll_blastwave");
  assert(scroll != null, "scroll should be creatable");
  inv.items.push(scroll);

  const castEvents = [];
  const usedEvents = [];
  world.on("castSpell", (e) => castEvents.push(e));
  world.on("item:used", (e) => usedEvents.push(e));

  world.add(player, UseIntent, { itemId: scroll });
  world.tick(1);

  assert(!world.isAlive(scroll), "scroll should be consumed on use");
  assert(!inv.items.includes(scroll), "consumed scroll should be removed from inventory");
  assertEquals(usedEvents.length, 1);

  const cast = castEvents.find((e) => e.spellId === "blastwave");
  assert(cast, "scroll use should emit castSpell for blastwave");
  assertEquals(cast.targetId, player);
  assertEquals(cast.source, undefined);
});

Deno.test("scroll of homecoming emits depth-0 teleport request and is consumed", () => {
  const world = new World({ seed: 103 });
  world.setScheduler((w) => scheduler(w));

  const player = createPlayer(world, { x: 7, y: 7, name: "Traveler" });
  const dsId = world.create();
  world.add(dsId, DungeonState, {
    worldSeed: world.seed >>> 0,
    currentDepth: 5,
    floorEntityIds: [],
  });
  const inv = world.get(player, Inventory);
  assert(inv && Array.isArray(inv.items), "player should have inventory");

  const scroll = createItemById(world, "scroll_homecoming");
  assert(scroll != null, "homecoming scroll should be creatable");
  inv.items.push(scroll);

  const castEvents = [];
  const teleportEvents = [];
  world.on("castSpell", (e) => castEvents.push(e));
  world.on("dungeon:teleport-depth", (e) => teleportEvents.push(e));

  world.add(player, UseIntent, { itemId: scroll });
  world.tick(1);

  assert(!world.isAlive(scroll), "homecoming scroll should be consumed on use");
  assert(!inv.items.includes(scroll), "consumed homecoming scroll should be removed from inventory");
  assertEquals(teleportEvents.length, 1);
  assertEquals(teleportEvents[0].actor, player);
  assertEquals(teleportEvents[0].targetDepth, 0);
  assertEquals(teleportEvents[0].source, "scroll_homecoming");
  assertEquals(teleportEvents[0].returnTicket?.depth, 5);
  assertEquals(teleportEvents[0].returnTicket?.x, 7);
  assertEquals(teleportEvents[0].returnTicket?.y, 7);

  const cast = castEvents.find((e) => e.spellId === "homecoming");
  assert(cast, "homecoming scroll should emit castSpell for homecoming");
  assertEquals(cast.targetId, player);
});
