import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { Beatitude } from "../src/rules/components/Beatitude.js";
import { ApplyIntent } from "../src/rules/components/Intents/ApplyIntent.js";
import { DrinkIntent } from "../src/rules/components/Intents/DrinkIntent.js";
import { ThrowIntent } from "../src/rules/components/Intents/ThrowIntent.js";
import { HazardArea } from "../src/rules/components/HazardArea.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { Position } from "../src/rules/components/Position.js";
import { applySystem } from "../src/rules/systems/applySystem.js";
import { drinkSystem } from "../src/rules/systems/drinkSystem.js";
import { installMaterialReactionListeners, materialReactionSystem } from "../src/rules/systems/materialReactionSystem.js";
import { throwSystem } from "../src/rules/systems/throwSystem.js";
import { createItemById } from "../src/rules/utils/itemFactory.js";

Deno.test("water potion drink clears burn and emits semantic event", () => {
  const world = new World({ seed: 9001 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], maxWeight: 100 });
  world.add(actor, ActiveEffects, {
    effects: [
      { key: "burn", potency: 1, turnsLeft: 5, onsetLeft: 0, peakLeft: 0 },
      { key: "regen", potency: 1, turnsLeft: 3, onsetLeft: 0, peakLeft: 0 },
    ],
  });

  const potion = createItemById(world, "potion_water");
  assert(potion != null, "water potion should be creatable");
  world.get(actor, Inventory).items.push(potion);

  const drank = [];
  world.on("water:drank", (ev) => drank.push(ev));

  world.add(actor, DrinkIntent, { itemId: potion, targetId: actor });
  drinkSystem(world);

  assertEquals(drank.length, 1);
  assertEquals(String(drank[0]?.waterType || ""), "plain");
  assertEquals(Number(drank[0]?.removedBurn || 0), 1);
  assert(!world.isAlive(potion), "drinking water should consume the potion");

  const ae = world.get(actor, ActiveEffects);
  assert(Array.isArray(ae?.effects), "active effects should remain present");
  assert(!ae.effects.some((e) => String(e?.key || "") === "burn"), "burn should be cleared");
  assert(ae.effects.some((e) => String(e?.key || "") === "regen"), "unrelated effects should remain");
});

Deno.test("holy water dip blesses target potion beatitude", () => {
  const world = new World({ seed: 9002 });
  installMaterialReactionListeners(world);
  const actor = world.create();
  world.add(actor, Inventory, { items: [], maxWeight: 100 });

  const holyWater = createItemById(world, "potion_water");
  const targetPotion = createItemById(world, "potion_vigor");
  assert(holyWater != null && targetPotion != null, "test potions should be creatable");

  world.add(holyWater, Beatitude, { state: "blessed" });

  const inv = world.get(actor, Inventory);
  inv.items.push(holyWater, targetPotion);

  const dipped = [];
  const applied = [];
  world.on("water:dipped", (ev) => dipped.push(ev));
  world.on("item:applied", (ev) => applied.push(ev));

  world.add(actor, ApplyIntent, { itemId: holyWater, targetItemId: targetPotion });
  applySystem(world);
  materialReactionSystem(world);

  assertEquals(dipped.length, 1);
  assertEquals(String(dipped[0]?.waterType || ""), "holy");
  assertEquals(applied.length, 1);
  assertEquals(String(applied[0]?.result?.type || ""), "water_dip");
  assert(!world.isAlive(holyWater), "dip should consume the water potion");
  assertEquals(String(world.get(targetPotion, Beatitude)?.state || ""), "blessed");
});

Deno.test("water dip waterlogs paper targets via material reaction rules", () => {
  const world = new World({ seed: 9004 });
  installMaterialReactionListeners(world);
  const actor = world.create();
  world.add(actor, Inventory, { items: [], maxWeight: 100 });

  const water = createItemById(world, "potion_water");
  const scroll = createItemById(world, "scroll_mapping");
  assert(water != null && scroll != null, "required items should be creatable");
  const inv = world.get(actor, Inventory);
  inv.items.push(water, scroll);

  const waterlogged = [];
  world.on("item:waterlogged", (ev) => waterlogged.push(ev));

  world.add(actor, ApplyIntent, { itemId: water, targetItemId: scroll });
  applySystem(world);
  materialReactionSystem(world);

  assert(!world.isAlive(water), "water dip should consume the potion");
  assertEquals(waterlogged.length, 1);
  assertEquals(Number(waterlogged[0]?.itemId || 0), scroll);
});

Deno.test("thrown water potion spawns wet splash hazard", () => {
  const world = new World({ seed: 9003 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], maxWeight: 100 });
  world.add(actor, Position, { x: 10, y: 10 });

  const potion = createItemById(world, "potion_water");
  assert(potion != null, "water potion should be creatable");
  world.get(actor, Inventory).items.push(potion);

  const thrown = [];
  const splashed = [];
  const hazards = [];
  world.on("item:thrown", (ev) => thrown.push(ev));
  world.on("water:splashed", (ev) => splashed.push(ev));
  world.on("hazard:spawned", (ev) => hazards.push(ev));

  world.add(actor, ThrowIntent, { itemId: potion, x: 20, y: 10 });
  throwSystem(world);

  assertEquals(thrown.length, 1);
  assertEquals(splashed.length, 1);
  assertEquals(hazards.length, 1);
  assertEquals(String(hazards[0]?.kind || ""), "wet_splash");
  assertEquals(String(hazards[0]?.medium || ""), "floor");
  assertEquals(String(splashed[0]?.waterType || ""), "plain");
  assertEquals(thrown[0]?.to?.x, hazards[0]?.at?.x);
  assertEquals(thrown[0]?.to?.y, hazards[0]?.at?.y);
  assert(!world.isAlive(potion), "throwing water should consume the potion");

  let foundHazard = false;
  for (const [, pos, hazard] of world.query(Position, HazardArea)) {
    if (String(hazard?.kind || "") !== "wet_splash") continue;
    foundHazard = true;
    assertEquals(pos.x, hazards[0].at.x);
    assertEquals(pos.y, hazards[0].at.y);
    assertEquals(String(hazard?.meta?.waterType || ""), "plain");
  }
  assert(foundHazard, "wet splash hazard entity should exist");
});
