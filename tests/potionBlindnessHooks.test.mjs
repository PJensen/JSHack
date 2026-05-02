import "./helpers/installContentCatalog.mjs";
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { Brain } from "../src/rules/components/Brain.js";
import { DrinkIntent } from "../src/rules/components/Intents/DrinkIntent.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { createPlayer } from "../src/rules/archetypes/Player.js";
import { drinkSystem } from "../src/rules/systems/drinkSystem.js";
import { getEffectiveVisionRange } from "../src/rules/utils/blind.js";
import { createItemById } from "../src/rules/utils/itemFactory.js";
import { addToInventory } from "../src/rules/utils/inventoryFacade.js";

Deno.test("potion blindness drink applies vision envelope and reduces effective vision", () => {
  const world = new World({ seed: 24680 });
  const actor = createPlayer(world, { name: "Hero" });
  if (!world.has(actor, Inventory)) {
    world.add(actor, Inventory, { items: [], maxWeight: 100 });
  }

  const brain = world.get(actor, Brain);
  brain.visionRange = 8;

  const potion = createItemById(world, "potion_blindness");
  assert(potion != null, "potion_blindness should be creatable");
  addToInventory(world, actor, potion);

  world.add(actor, DrinkIntent, { itemId: potion, targetId: actor });
  drinkSystem(world);

  const ae = world.get(actor, ActiveEffects);
  const envelope = ae?.effects?.find((e) => e && e.key === "stat_envelope" && e.stat === "visionRange");
  assert(envelope, "blindness potion should add a visionRange stat_envelope effect");
  assertEquals(Number(envelope.turnsLeft || 0), 20);

  const effectiveVision = getEffectiveVisionRange(world, actor);
  assertEquals(effectiveVision, 0, "blindness potion should immediately black out vision");
  assert(!world.isAlive(potion), "drinking the potion should consume it");
});
