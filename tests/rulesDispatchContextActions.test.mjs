import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { makeRulesDispatcher } from "../src/main/input/rulesDispatch.js";
import { Position } from "../src/rules/components/Position.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { Interactable } from "../src/rules/components/Interactable.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { PickupIntent } from "../src/rules/components/Intents/PickupIntent.js";
import { InteractIntent } from "../src/rules/components/Intents/InteractIntent.js";
import { addToInventory } from "../src/rules/utils/inventoryFacade.js";

Deno.test("rulesDispatch: openPickupChooser picks nearby scattered item", () => {
  const world = new World({ seed: 101 });
  const actor = world.create();
  world.add(actor, Position, { x: 5, y: 5 });

  const item = world.create();
  world.add(item, Position, { x: 7, y: 5 }); // within scan radius 3, outside actor tile
  world.add(item, ItemInfo, { type: "scroll", count: 1 });

  let tickCount = 0;
  world.tick = () => { tickCount += 1; };

  const dispatch = makeRulesDispatcher(world, () => actor);
  dispatch({ type: "rules.openPickupChooser" });

  const pickup = world.get(actor, PickupIntent);
  assertEquals(!!pickup, true);
  assertEquals(pickup.targetId, item);
  assertEquals(tickCount, 1);
});

Deno.test("rulesDispatch: openPickupChooser opens chest when no floor pickup", () => {
  const world = new World({ seed: 102 });
  const actor = world.create();
  world.add(actor, Position, { x: 8, y: 8 });

  const chest = world.create();
  world.add(chest, Position, { x: 8, y: 8 });
  world.add(chest, Interactable, { action: "openChest", params: {} });
  world.add(chest, Inventory, { capacity: 20 });

  const chestItem = world.create();
  world.add(chestItem, NamedIdentity, { name: "Arrow", identity: "arrow_basic" });
  world.add(chestItem, ItemInfo, { type: "ammo", count: 4 });
  addToInventory(world, chest, chestItem);

  let tickCount = 0;
  world.tick = () => { tickCount += 1; };

  const dispatch = makeRulesDispatcher(world, () => actor);
  dispatch({ type: "rules.openPickupChooser" });

  const interact = world.get(actor, InteractIntent);
  assertEquals(!!interact, true);
  assertEquals(interact.targetId, chest);
  assertEquals(tickCount, 1);
});

Deno.test("rulesDispatch: traverseStairs picks up underfoot item before traversing", () => {
  const world = new World({ seed: 103 });
  const actor = world.create();
  world.add(actor, Position, { x: 3, y: 3 });

  const item = world.create();
  world.add(item, Position, { x: 3, y: 3 });
  world.add(item, ItemInfo, { type: "tool", count: 1 });

  const traversals = [];
  world.on("stair:traverse", (ev) => traversals.push(ev));
  world.on("portal:return", (ev) => traversals.push(ev));

  let tickCount = 0;
  world.tick = () => { tickCount += 1; };

  const dispatch = makeRulesDispatcher(world, () => actor);
  dispatch({ type: "rules.traverseStairs" });

  const pickup = world.get(actor, PickupIntent);
  assertEquals(!!pickup, true);
  assertEquals(pickup.targetId, item);
  assertEquals(traversals.length, 0);
  assertEquals(tickCount, 1);
});

Deno.test("rulesDispatch: traverseStairs emits explicit return-portal traversal", () => {
  const world = new World({ seed: 104 });
  const actor = world.create();
  world.add(actor, Position, { x: 1, y: 1 });

  const returns = [];
  world.on("portal:return", (ev) => returns.push(ev));

  const dispatch = makeRulesDispatcher(world, () => actor);
  dispatch({ type: "rules.traverseStairs", payload: { targetId: 77, direction: "return" } });

  assertEquals(returns.length, 1);
  assertEquals(returns[0]?.actor, actor);
  assertEquals(returns[0]?.targetId, 77);
  assertEquals(returns[0]?.portalId, 77);
});
