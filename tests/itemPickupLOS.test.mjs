import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Position } from "../src/rules/components/Position.js";
import { Player } from "../src/rules/components/Player.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { Collider } from "../src/rules/components/Collider.js";
import { PickupIntent } from "../src/rules/components/Intents/PickupIntent.js";
import { itemPickupSystem } from "../src/rules/systems/itemPickupSystem.js";
import { inventoryContains } from "../src/rules/utils/inventoryFacade.js";

Deno.test("pickup cannot reach a ground item through a wall", () => {
  const world = new World({ seed: 42 });
  const playerId = world.create();
  const wallId = world.create();
  const itemId = world.create();

  world.add(playerId, Player, {});
  world.add(playerId, Position, { x: 1, y: 1 });
  world.add(playerId, Inventory, { capacity: 20 });
  world.add(playerId, PickupIntent, { targetId: itemId });
  world.add(wallId, Position, { x: 2, y: 1 });
  world.add(wallId, Collider, { solid: true, blocksSight: true });
  world.add(itemId, Position, { x: 3, y: 1 });
  world.add(itemId, ItemInfo, { type: "gem", count: 1, weight: 0.1 });

  const denied = [];
  world.on("item:pickup-denied", (event) => denied.push(event));

  itemPickupSystem(world);

  assert(!inventoryContains(world, playerId, itemId));
  assertEquals(world.get(itemId, Position), { x: 3, y: 1 });
  assertEquals(denied.length, 1);
  assertEquals(denied[0].reason, "blocked");
});
