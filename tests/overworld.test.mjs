import { assert } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { initDungeon } from "../src/rules/environment/dungeon/index.js";
import { transitionToDepth } from "../src/rules/environment/dungeon/transition.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Position } from "../src/rules/components/Position.js";
import { Player } from "../src/rules/components/Player.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { HarvestNode } from "../src/rules/components/HarvestNode.js";
import { InteractIntent } from "../src/rules/components/Intents/InteractIntent.js";
import { isWalkable, clearAll } from "../src/rules/environment/dungeon/tileMap.js";
import { createFrom } from "../src/lib/ecs-js/archetype.js";
import { WildBerries } from "../src/rules/archetypes/Food.js";
import { interactionSystem } from "../src/rules/systems/interactionSystem.js";
import { addToInventory, inventoryContains, inventoryItems } from "../src/rules/utils/inventoryFacade.js";

function makePlayerAt(world, x, y) {
  const id = world.create();
  world.add(id, Player, {});
  world.add(id, Position, { x, y });
  return id;
}

Deno.test("initDungeon supports depth 0 overworld", () => {
  clearAll();
  const world = new World({ seed: 0xa77a77 });
  const spawn = initDungeon(world, { startDepth: 0 });

  assert(isWalkable(spawn.x, spawn.y), "overworld spawn tile is walkable");

  let depth = -1;
  for (const [, ds] of world.query(DungeonState)) {
    depth = ds.currentDepth;
    break;
  }
  assert(depth === 0, `expected currentDepth 0, got ${depth}`);
});

Deno.test("overworld contains a down stair entity", () => {
  clearAll();
  const world = new World({ seed: 0xC0FFEE });
  initDungeon(world, { startDepth: 0 });

  let found = false;
  for (const [, ni] of world.query(NamedIdentity)) {
    if (ni.identity === "stair_down") {
      found = true;
      break;
    }
  }
  assert(found, "expected at least one stair_down in overworld");
});

Deno.test("overworld includes home interactables and harvest nodes", () => {
  clearAll();
  const world = new World({ seed: 0xC0FFEE });
  initDungeon(world, { startDepth: 0 });

  let bed = 0;
  let sign = 0;
  let chest = 0;
  let berry = 0;
  let herbs = 0;
  let bench = 0;
  let thorn = 0;
  let venom = 0;
  for (const [, ni] of world.query(NamedIdentity)) {
    if (ni.identity === "bed_home") bed++;
    if (ni.identity === "house_sign") sign++;
    if (ni.identity === "chest") chest++;
    if (ni.identity === "berry_bush") berry++;
    if (ni.identity === "herb_patch") herbs++;
    if (ni.identity === "alchemy_bench") bench++;
    if (ni.identity === "thorn_bramble") thorn++;
    if (ni.identity === "venom_fern") venom++;
  }

  assert(bed >= 1, "expected at least one bed_home");
  assert(sign >= 1, "expected at least one house_sign");
  assert(chest >= 1, "expected at least one chest");
  assert(berry >= 1, "expected berry bushes");
  assert(herbs >= 1, "expected herb patches");
  assert(bench >= 1, "expected an alchemy bench");
  assert(thorn >= 1, "expected dangerous thorn brambles");
  assert(venom >= 1, "expected dangerous venom ferns");
});

Deno.test("can transition depth 0 -> 1 -> 0", () => {
  clearAll();
  const world = new World({ seed: 42 });
  const spawn = initDungeon(world, { startDepth: 0 });
  makePlayerAt(world, spawn.x, spawn.y);

  transitionToDepth(world, 1, { x: 0, y: 0 }, { direction: "down" });
  let d1 = -1;
  for (const [, ds] of world.query(DungeonState)) { d1 = ds.currentDepth; break; }
  assert(d1 === 1, "expected depth 1 after descending");

  transitionToDepth(world, 0, { x: 0, y: 0 }, { direction: "up" });
  let d0 = -1;
  for (const [, ds] of world.query(DungeonState)) { d0 = ds.currentDepth; break; }
  assert(d0 === 0, "expected depth 0 after ascending");
});

Deno.test("overworld stash chest and harvest states persist across transitions", () => {
  clearAll();
  const world = new World({ seed: 4242 });
  const spawn = initDungeon(world, { startDepth: 0 });
  const actor = makePlayerAt(world, spawn.x, spawn.y);
  world.add(actor, Inventory, { capacity: 20 });

  let chestId = 0;
  let harvestId = 0;
  for (const [id, ni] of world.query(NamedIdentity)) {
    if (ni.name === "Stash Chest") chestId = id;
    if (!harvestId && (ni.identity === "berry_bush" || ni.identity === "herb_patch")) harvestId = id;
  }
  assert(chestId > 0, "stash chest should exist");
  assert(harvestId > 0, "harvest node should exist");
  const harvestPos = world.get(harvestId, Position);
  const harvestKind = world.get(harvestId, HarvestNode)?.kind || "";

  const stashItem = createFrom(world, WildBerries, {});
  addToInventory(world, chestId, stashItem);

  world.add(actor, InteractIntent, { targetId: harvestId });
  interactionSystem(world);
  const pickedState = world.get(harvestId, HarvestNode);
  assert(pickedState.ready === false, "harvest node should be on cooldown after harvest");

  transitionToDepth(world, 1, { x: 0, y: 0 }, { direction: "down" });
  transitionToDepth(world, 0, { x: 0, y: 0 }, { direction: "up" });

  let chest2 = 0;
  let harvest2 = 0;
  for (const [id, ni, pos] of world.query(NamedIdentity, Position)) {
    if (ni.name === "Stash Chest") chest2 = id;
    if (!harvest2 && (ni.identity === "berry_bush" || ni.identity === "herb_patch")) {
      const hn = world.get(id, HarvestNode);
      if (hn?.kind === harvestKind && pos.x === harvestPos.x && pos.y === harvestPos.y) {
        harvest2 = id;
      }
    }
  }
  assert(chest2 > 0, "stash chest should respawn");
  assert(harvest2 > 0, "harvest node should respawn");

  const chestItems2 = inventoryItems(world, chest2);
  assert(chestItems2.length >= 1, "stash chest should retain stored items");
  // Entity IDs are remapped during transition, so check by identity, not by old ID.
  const hasBerries = chestItems2.some(id => {
    const ni = world.get(id, NamedIdentity);
    return ni && ni.identity === "food_wild_berries";
  });
  assert(hasBerries, "stash chest should contain the stored berries");

  const harvestState2 = world.get(harvest2, HarvestNode);
  assert(harvestState2.ready === false, "harvest cooldown state should persist");
});
