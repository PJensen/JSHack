import "./helpers/installContentCatalog.mjs";
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { HazardArea } from "../src/rules/components/HazardArea.js";
import { ThrowIntent } from "../src/rules/components/Intents/ThrowIntent.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { createItemById } from "../src/rules/utils/itemFactory.js";
import { hazardSystem } from "../src/rules/systems/hazardSystem.js";
import { throwSystem } from "../src/rules/systems/throwSystem.js";
import { addToInventory } from "../src/rules/utils/inventoryFacade.js";

function makeActor(world, x, y, hp) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Vitality, { hp, maxHp: hp });
  return id;
}

Deno.test("throwing potion_poison spawns poison hazard, consumes item, and does no burst damage", () => {
  const world = new World({ seed: 9401 });

  const actor = makeActor(world, 10, 10, 12);
  world.add(actor, Inventory, { items: [], maxWeight: 100 });

  const target = makeActor(world, 12, 10, 10);
  const potion = createItemById(world, "potion_poison");
  assert(potion != null, "potion_poison should be creatable");
  addToInventory(world, actor, potion);

  const hazardSpawned = [];
  const plasmaSpawned = [];
  const results = [];
  world.on("hazard:spawned", (ev) => hazardSpawned.push(ev));
  world.on("plasmaCloud:spawned", (ev) => plasmaSpawned.push(ev));
  world.on("interaction:result", (ev) => results.push(ev));

  world.add(actor, ThrowIntent, { itemId: potion, x: 12, y: 10 });
  throwSystem(world);

  assertEquals(results.length, 1);
  assertEquals(results[0].verb, "throw");
  assertEquals(results[0].ok, true);
  assertEquals(results[0].metrics.path, "itemHooks");
  assert(!world.isAlive(potion), "on_throw should consume potion_poison");
  assertEquals(world.get(target, Vitality).hp, 10, "throw action should not deal direct burst damage");

  assertEquals(plasmaSpawned.length, 0, "poison hazard should not emit plasma cloud spawn events");
  assertEquals(hazardSpawned.length, 1);
  assertEquals(String(hazardSpawned[0].kind), "poison");
  assertEquals(String(hazardSpawned[0].medium), "floor");

  let poisonHazard = null;
  for (const [id, pos, hz] of world.query(Position, HazardArea)) {
    if ((pos.x | 0) !== 12 || (pos.y | 0) !== 10) continue;
    if (String(hz.kind || "") !== "poison") continue;
    poisonHazard = { id, hz };
    break;
  }
  assert(poisonHazard, "throw hook should spawn poison hazard at landing tile");
  assertEquals(String(poisonHazard.hz.medium), "floor");
  assertEquals(Number(poisonHazard.hz.tickDamage), 2);
  assertEquals(Number(poisonHazard.hz.radius), 1);
  assertEquals(Number(poisonHazard.hz.turnsLeft), 3);

  hazardSystem(world);
  assertEquals(world.get(target, Vitality).hp, 8, "hazard tick should apply poison damage");
});
