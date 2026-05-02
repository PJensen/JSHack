import "./helpers/installContentCatalog.mjs";
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import { Faction } from "../src/rules/components/Faction.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Position } from "../src/rules/components/Position.js";
import { ShopInventory } from "../src/rules/components/ShopInventory.js";
import { TownState } from "../src/rules/components/TownState.js";
import { WeatherState } from "../src/rules/components/WeatherState.js";
import { townSimulationSystem } from "../src/rules/systems/townSimulationSystem.js";
import { addToInventory, inventoryItems } from "../src/rules/utils/inventoryFacade.js";
import { createItemById } from "../src/rules/utils/itemFactory.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";

function addStorage(world, name, identity, x, y) {
  const id = world.create();
  world.add(id, NamedIdentity, { name, identity });
  world.add(id, Position, { x, y });
  world.add(id, Inventory, { capacity: 30 });
  return id;
}

function countInventory(world, ownerId, identity) {
  let total = 0;
  for (const itemId of inventoryItems(world, ownerId)) {
    const ni = world.get(itemId, NamedIdentity);
    if (String(ni?.identity || "") === identity) {
      const info = world.get(itemId, ItemInfo);
      total += Math.max(1, Number(info?.count || 0) | 0);
    }
  }
  return total;
}

function seedInventory(world, ownerId, itemId, count) {
  for (let i = 0; i < count; i++) {
    const id = createItemById(world, itemId);
    if (id) addToInventory(world, ownerId, id);
  }
}

Deno.test("townSimulationSystem mills grain, forges tools, cooks tavern meals, and updates state", () => {
  const world = new World({ seed: 101 });
  world.step = 24;

  const ds = world.create();
  world.add(ds, DungeonState, {
    worldSeed: 101,
    currentDepth: 0,
    profileType: "overworld",
    floorEntityIds: [],
    downStairPositions: [],
  });

  const ws = world.create();
  world.add(ws, WeatherState, { current: "clear", turnsRemaining: 20, transitionCooldown: 0 });

  const sign = world.create();
  world.add(sign, NamedIdentity, { name: "Home Sign", identity: "house_sign" });
  world.add(sign, Position, { x: 10, y: 10 });

  const mill = addStorage(world, "Mill Chest", "chest", 8, 8);
  const smithy = addStorage(world, "Smithy Chest", "chest", 7, 8);
  const lumber = addStorage(world, "Lumber Chest", "lumber_chest", 7, 9);
  const herb = addStorage(world, "Herb Chest", "herb_chest", 6, 8);
  const tavern = addStorage(world, "Tavern Chest", "tavern_chest", 9, 8);

  seedInventory(world, mill, "food_wheat", 1);
  seedInventory(world, smithy, "ore_iron", 1);
  seedInventory(world, smithy, "ore_coal", 1);
  seedInventory(world, smithy, "material_lumber", 1);
  seedInventory(world, herb, "food_wild_herbs", 2);
  seedInventory(world, tavern, "food_flour", 1);
  seedInventory(world, tavern, "water_bucket", 1);
  seedInventory(world, tavern, "fuel_firewood", 1);
  seedInventory(world, tavern, "tool_kitchen_knife", 1);

  const stateId = world.create();
  world.add(stateId, TownState, { nextPulseStep: 0 });

  townSimulationSystem(world);

  assertEquals(countInventory(world, mill, "food_wheat"), 0);
  assertEquals(countInventory(world, mill, "food_flour"), 1);
  assertEquals(countInventory(world, smithy, "ore_iron"), 0);
  assertEquals(countInventory(world, smithy, "ore_coal"), 0);
  assertEquals(countInventory(world, smithy, "tool_hatchet"), 1);
  assertEquals(countInventory(world, tavern, "food_stew"), 1, "tavern should buffer cooked stew for the next feeding pulse");
  assertEquals(countInventory(world, tavern, "tool_kitchen_knife"), 1, "kitchen knife should remain in storage");
  assertEquals(countInventory(world, tavern, "water_bucket"), 1, "water bucket should remain available for repeated cooking");

  const state = world.get(stateId, TownState);
  assert(state, "TownState should exist");
  assertEquals(state.foodStores, 2);
  assertEquals(state.materialStores, 1);
  assertEquals(state.lowMedicine, true);
});

Deno.test("townSimulationSystem keeps a visible tavern meal reserve instead of draining it dry", () => {
  const world = new World({ seed: 103 });
  world.step = 24;

  const ds = world.create();
  world.add(ds, DungeonState, {
    worldSeed: 103,
    currentDepth: 0,
    profileType: "overworld",
    floorEntityIds: [],
    downStairPositions: [],
  });

  const ws = world.create();
  world.add(ws, WeatherState, { current: "clear", turnsRemaining: 20, transitionCooldown: 0 });

  const sign = world.create();
  world.add(sign, NamedIdentity, { name: "Home Sign", identity: "house_sign" });
  world.add(sign, Position, { x: 10, y: 10 });

  const tavern = addStorage(world, "Tavern Chest", "tavern_chest", 9, 8);
  seedInventory(world, tavern, "food_stew", 1);

  const stateId = world.create();
  world.add(stateId, TownState, { nextPulseStep: 0 });

  townSimulationSystem(world);

  assertEquals(countInventory(world, tavern, "food_stew"), 1, "town should keep at least one prepared meal on hand");
});

Deno.test("townSimulationSystem cooks fish into tavern stew", () => {
  const world = new World({ seed: 105 });
  world.step = 24;

  const ds = world.create();
  world.add(ds, DungeonState, {
    worldSeed: 105,
    currentDepth: 0,
    profileType: "overworld",
    floorEntityIds: [],
    downStairPositions: [],
  });

  const ws = world.create();
  world.add(ws, WeatherState, { current: "clear", turnsRemaining: 20, transitionCooldown: 0 });

  const tavern = addStorage(world, "Tavern Chest", "tavern_chest", 9, 8);
  seedInventory(world, tavern, "food_raw_fish", 1);
  seedInventory(world, tavern, "fuel_firewood", 1);
  seedInventory(world, tavern, "tool_kitchen_knife", 1);

  const stateId = world.create();
  world.add(stateId, TownState, { nextPulseStep: 0 });

  townSimulationSystem(world);

  assertEquals(countInventory(world, tavern, "food_raw_fish"), 0);
  assertEquals(countInventory(world, tavern, "food_stew"), 1);
});

Deno.test("townSimulationSystem counts the herbalist stash instead of the apothecary chest", () => {
  const world = new World({ seed: 104 });
  world.step = 24;

  const ds = world.create();
  world.add(ds, DungeonState, {
    worldSeed: 104,
    currentDepth: 0,
    profileType: "overworld",
    floorEntityIds: [],
    downStairPositions: [],
  });

  const ws = world.create();
  world.add(ws, WeatherState, { current: "clear", turnsRemaining: 20, transitionCooldown: 0 });

  const sign = world.create();
  world.add(sign, NamedIdentity, { name: "Home Sign", identity: "house_sign" });
  world.add(sign, Position, { x: 10, y: 10 });

  const alchemist = world.create();
  world.add(alchemist, NamedIdentity, { name: "Alchemist", identity: "townfolk_alchemist" });
  world.add(alchemist, Position, { x: 30, y: 30 });
  world.add(alchemist, ShopInventory, { buyMarkup: 1.3, sellDiscount: 0.5 });

  const herbalist = world.create();
  world.add(herbalist, NamedIdentity, { name: "Herbalist", identity: "townfolk_herbalist" });
  world.add(herbalist, Position, { x: 6, y: 8 });

  const apothecaryChest = addStorage(world, "Herb Chest", "herb_chest", 31, 30);
  const herbalistChest = addStorage(world, "Herb Chest", "herb_chest", 7, 8);
  seedInventory(world, herbalistChest, "food_wild_herbs", 2);
  seedInventory(world, herbalistChest, "reagent_venom_frond", 1);

  const stateId = world.create();
  world.add(stateId, TownState, { nextPulseStep: 0 });

  townSimulationSystem(world);

  const state = world.get(stateId, TownState);
  assert(state, "TownState should exist");
  assertEquals(countInventory(world, apothecaryChest, "food_wild_herbs"), 0);
  assertEquals(countInventory(world, herbalistChest, "food_wild_herbs"), 2);
  assertEquals(state.medicineStores, 3);
  assertEquals(state.lowMedicine, false);
});

Deno.test("townSimulationSystem tracks weather and hostile pressure in morale", () => {
  const world = new World({ seed: 102 });
  world.step = 40;

  const ds = world.create();
  world.add(ds, DungeonState, {
    worldSeed: 102,
    currentDepth: 0,
    profileType: "overworld",
    floorEntityIds: [],
    downStairPositions: [],
  });

  const ws = world.create();
  world.add(ws, WeatherState, { current: "heavy_rain", turnsRemaining: 8, transitionCooldown: 0 });

  const sign = world.create();
  world.add(sign, NamedIdentity, { name: "Home Sign", identity: "house_sign" });
  world.add(sign, Position, { x: 10, y: 10 });

  const hostile = world.create();
  world.add(hostile, Position, { x: 14, y: 10 });
  world.add(hostile, Faction, { key: "monster" });

  townSimulationSystem(world);

  let state = null;
  for (const [, rec] of world.query(TownState)) state = rec;
  assert(state, "TownState should be created");
  assertEquals(state.weather, "heavy_rain");
  assertEquals(state.threatLevel, 1);
  assert(state.morale < 50, "threat and storm should drag morale down");
});
