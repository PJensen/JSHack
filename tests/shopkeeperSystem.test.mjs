import { assert } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { shopkeeperSystem } from "../src/rules/systems/shopkeeperSystem.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { MoveIntent } from "../src/rules/components/Intents/MoveIntent.js";
import { RoomMetadata } from "../src/rules/components/RoomMetadata.js";
import { Unpaid } from "../src/rules/components/Unpaid.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { addToInventory } from "../src/rules/utils/inventoryFacade.js";

Deno.test("shopkeeperSystem blocks exiting shop with unpaid items and emits invoice bill", () => {
  const world = new World({ seed: 42 });
  const playerId = world.create();
  const itemId = world.create();

  world.add(playerId, Player, {});
  world.add(playerId, Position, { x: 2, y: 2 });
  world.add(playerId, Inventory, { capacity: 20 });
  world.add(playerId, MoveIntent, { dx: -1, dy: 0 }); // move to x=1, outside room

  world.add(itemId, ItemInfo, { type: "equip", count: 1, value: 50 });
  world.add(itemId, Unpaid, { shopkeeperId: 9001, price: 75 });
  addToInventory(world, playerId, itemId);

  const roomId = world.create();
  world.add(roomId, RoomMetadata, {
    roomType: "shop",
    x: 2,
    y: 2,
    w: 3,
    h: 3,
    shopkeeperId: 9001,
  });

  const blocked = [];
  world.on("shop:exit-blocked", (ev) => blocked.push(ev));

  shopkeeperSystem(world);

  assert(!world.has(playerId, MoveIntent), "move intent should be consumed when bill is unpaid");
  assert(blocked.length === 1, "shopkeeper should block exit once");
  assert(blocked[0].shopkeeperId === 9001, "event should include blocking shopkeeper");
  assert(blocked[0].bill === 75, "event should report unpaid invoice total");
});

Deno.test("shopkeeperSystem allows exiting shop when player has no unpaid items", () => {
  const world = new World({ seed: 42 });
  const playerId = world.create();

  world.add(playerId, Player, {});
  world.add(playerId, Position, { x: 2, y: 2 });
  world.add(playerId, Inventory, { capacity: 20 });
  world.add(playerId, MoveIntent, { dx: -1, dy: 0 }); // move to x=1, outside room

  const roomId = world.create();
  world.add(roomId, RoomMetadata, {
    roomType: "shop",
    x: 2,
    y: 2,
    w: 3,
    h: 3,
    shopkeeperId: 9001,
  });

  let blockedCount = 0;
  world.on("shop:exit-blocked", () => blockedCount++);

  shopkeeperSystem(world);

  assert(world.has(playerId, MoveIntent), "move intent should remain when nothing is unpaid");
  assert(blockedCount === 0, "no blocked event when invoice is zero");
});
