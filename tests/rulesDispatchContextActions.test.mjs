import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { makeRulesDispatcher } from "../src/main/input/rulesDispatch.js";
import { Position } from "../src/rules/components/Position.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { Interactable } from "../src/rules/components/Interactable.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { RiftPortal } from "../src/rules/components/RiftPortal.js";
import { PickupIntent } from "../src/rules/components/Intents/PickupIntent.js";
import { InteractIntent } from "../src/rules/components/Intents/InteractIntent.js";
import { addToInventory } from "../src/rules/utils/inventoryFacade.js";
import { RiftEnterRequested } from "../src/events/RiftEnterRequested.js";

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

Deno.test("rulesDispatch: traverseStairs emits explicit rift portal traversal", () => {
  const world = new World({ seed: 105 });
  const actor = world.create();
  world.add(actor, Position, { x: 1, y: 1 });

  const portal = world.create();
  world.add(portal, Position, { x: 1, y: 1 });
  world.add(portal, NamedIdentity, { name: "Rift Portal", identity: "rift_portal" });
  world.add(portal, RiftPortal, { riftId: "rift:test", seed: 123, levels: 3 });

  const requests = [];
  world.on(RiftEnterRequested, (ev) => requests.push(ev));

  const dispatch = makeRulesDispatcher(world, () => actor);
  dispatch({ type: "rules.traverseStairs", payload: { targetId: portal, direction: "rift" } });

  assertEquals(requests.length, 1);
  assertEquals(requests[0]?.actor, actor);
  assertEquals(requests[0]?.portalId, portal);
  assertEquals(requests[0]?.riftId, "rift:test");
});

Deno.test("rulesDispatch: traverseStairs finds underfoot rift portal without touching return portals", () => {
  const world = new World({ seed: 106 });
  const actor = world.create();
  world.add(actor, Position, { x: 2, y: 2 });

  const portal = world.create();
  world.add(portal, Position, { x: 2, y: 2 });
  world.add(portal, NamedIdentity, { name: "Rift Portal", identity: "rift_portal" });
  world.add(portal, RiftPortal, { riftId: "rift:underfoot", seed: 456, levels: 2 });

  const requests = [];
  const returns = [];
  world.on(RiftEnterRequested, (ev) => requests.push(ev));
  world.on("portal:return", (ev) => returns.push(ev));

  const dispatch = makeRulesDispatcher(world, () => actor);
  dispatch({ type: "rules.traverseStairs" });

  assertEquals(requests.length, 1);
  assertEquals(requests[0]?.portalId, portal);
  assertEquals(returns.length, 0);
});
