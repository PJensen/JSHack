import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { makeRulesDispatcher } from "../src/main/input/rulesDispatch.js";
import { Position } from "../src/rules/components/Position.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { Settings } from "../src/rules/components/Settings.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { Interactable } from "../src/rules/components/Interactable.js";
import { PickupIntent } from "../src/rules/components/Intents/PickupIntent.js";
import { InteractIntent } from "../src/rules/components/Intents/InteractIntent.js";
import { MoveIntent } from "../src/rules/components/Intents/MoveIntent.js";
import { addToInventory } from "../src/rules/utils/inventoryFacade.js";

function makeWorldAt(x = 5, y = 5) {
  const world = new World({ seed: 17 });
  const actor = world.create();
  world.add(actor, Position, { x, y });
  world.add(actor, Inventory, { items: [], capacity: 20 });
  world.add(actor, Settings, { autoPickup: true, autoPickupKinds: ["currency"], pickupRange: 1 });

  let tickCount = 0;
  world.tick = () => { tickCount += 1; };

  return { world, actor, getTickCount: () => tickCount };
}

Deno.test("rulesDispatch worldTap: taps adjacent item and queues pickup intent", () => {
  const { world, actor, getTickCount } = makeWorldAt(5, 5);
  const item = world.create();
  world.add(item, Position, { x: 6, y: 5 });
  world.add(item, ItemInfo, { type: "scroll", count: 1 });

  const dispatch = makeRulesDispatcher(world, () => actor);
  dispatch({ type: "rules.worldTap", payload: { x: 6, y: 5 } });

  const intent = world.get(actor, PickupIntent);
  assertEquals(!!intent, true);
  assertEquals(intent.targetId, item);
  assertEquals(world.has(actor, InteractIntent), false);
  assertEquals(world.has(actor, MoveIntent), false);
  assertEquals(getTickCount(), 1);
});

Deno.test("rulesDispatch worldTap: taps adjacent interactable and queues interact intent", () => {
  const { world, actor, getTickCount } = makeWorldAt(5, 5);
  const chest = world.create();
  world.add(chest, Position, { x: 6, y: 5 });
  world.add(chest, Interactable, { action: "openChest", params: {} });

  const dispatch = makeRulesDispatcher(world, () => actor);
  dispatch({ type: "rules.worldTap", payload: { x: 6, y: 5 } });

  const intent = world.get(actor, InteractIntent);
  assertEquals(!!intent, true);
  assertEquals(intent.targetId, chest);
  assertEquals(world.has(actor, PickupIntent), false);
  assertEquals(world.has(actor, MoveIntent), false);
  assertEquals(getTickCount(), 1);
});

Deno.test("rulesDispatch worldTap: disambiguates nearby pickup tile when tap is slightly off", () => {
  const { world, actor, getTickCount } = makeWorldAt(5, 5);
  const item = world.create();
  world.add(item, Position, { x: 6, y: 5 });
  world.add(item, ItemInfo, { type: "scroll", count: 1 });

  const dispatch = makeRulesDispatcher(world, () => actor);
  dispatch({ type: "rules.worldTap", payload: { x: 7, y: 5 } });

  const intent = world.get(actor, PickupIntent);
  assertEquals(!!intent, true);
  assertEquals(intent.targetId, item);
  assertEquals(world.has(actor, MoveIntent), false);
  assertEquals(getTickCount(), 1);
});

Deno.test("rulesDispatch worldTap: unopened chest interaction is prioritized over floor pickup", () => {
  const { world, actor, getTickCount } = makeWorldAt(5, 5);
  const chest = world.create();
  world.add(chest, Position, { x: 6, y: 5 });
  world.add(chest, Interactable, { action: "openChest", params: {} });
  world.add(chest, Inventory, { items: [], capacity: 20 });
  const chestItem = world.create();
  world.add(chestItem, ItemInfo, { type: "scroll", count: 1 });
  addToInventory(world, chest, chestItem);

  const floorItem = world.create();
  world.add(floorItem, Position, { x: 6, y: 5 });
  world.add(floorItem, ItemInfo, { type: "weapon", count: 1 });

  const dispatch = makeRulesDispatcher(world, () => actor);
  dispatch({ type: "rules.worldTap", payload: { x: 6, y: 5 } });

  const interact = world.get(actor, InteractIntent);
  assertEquals(!!interact, true);
  assertEquals(interact.targetId, chest);
  assertEquals(world.has(actor, PickupIntent), false);
  assertEquals(getTickCount(), 1);
});

Deno.test("rulesDispatch worldTap: taps distant tile and moves one step toward it", () => {
  const { world, actor, getTickCount } = makeWorldAt(5, 5);
  const dispatch = makeRulesDispatcher(world, () => actor);
  dispatch({ type: "rules.worldTap", payload: { x: 10, y: 7 } });

  const intent = world.get(actor, MoveIntent);
  assertEquals(!!intent, true);
  assertEquals(intent.dx, 1);
  assertEquals(intent.dy, 0);
  assertEquals(world.has(actor, PickupIntent), false);
  assertEquals(world.has(actor, InteractIntent), false);
  assertEquals(getTickCount(), 1);
});

Deno.test("rulesDispatch worldTap: item outside pickup range falls back to move", () => {
  const { world, actor, getTickCount } = makeWorldAt(5, 5);
  const item = world.create();
  world.add(item, Position, { x: 8, y: 5 });
  world.add(item, ItemInfo, { type: "weapon", count: 1 });

  const dispatch = makeRulesDispatcher(world, () => actor);
  dispatch({ type: "rules.worldTap", payload: { x: 8, y: 5 } });

  const intent = world.get(actor, MoveIntent);
  assertEquals(!!intent, true);
  assertEquals(intent.dx, 1);
  assertEquals(intent.dy, 0);
  assertEquals(world.has(actor, PickupIntent), false);
  assertEquals(world.has(actor, InteractIntent), false);
  assertEquals(getTickCount(), 1);
});
