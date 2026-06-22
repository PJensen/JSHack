import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { DoorKey } from "../src/rules/components/DoorKey.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { RAT_CELLAR_LOCK_ID } from "../src/rules/data/questLocks.js";
import { getUnderworldRegionTemplate } from "../src/rules/environment/dungeon/underworldRegions.js";
import { canTraverseDungeonEntrance } from "../src/main/wiring/transitionWiring.js";
import { addToInventory } from "../src/rules/utils/inventoryFacade.js";

Deno.test("rat cellar is a very-hard keyed gate", () => {
  const entrance = getUnderworldRegionTemplate("tavern_basement");
  assertEquals(entrance.lockId, RAT_CELLAR_LOCK_ID);
  assertEquals(entrance.lockDifficulty, "very_hard");

  const world = new World({ seed: 3 });
  const player = world.create();
  world.add(player, Inventory, { capacity: 4 });
  assertEquals(canTraverseDungeonEntrance(world, player, entrance), false);

  const key = world.create();
  world.add(key, ItemInfo, { type: "tool", weight: 0.1, value: 0, description: "test", count: 1 });
  world.add(key, DoorKey, { lockId: RAT_CELLAR_LOCK_ID });
  addToInventory(world, player, key);
  assertEquals(canTraverseDungeonEntrance(world, player, entrance), true);
});

