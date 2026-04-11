import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { InventoryRoot } from "../src/rules/components/InventoryRoot.js";
import { Unpaid } from "../src/rules/components/Unpaid.js";
import { Weight } from "../src/rules/components/Weight.js";
import { attach, getParent, isChild } from "../src/lib/ecs-js/hierarchy.js";
import {
  addToInventory,
  clearInventory,
  consumeFromStack,
  findInventoryRoot,
  forEachItem,
  getOrCreateInventoryRoot,
  getStackCount,
  getStackView,
  hasCapacity,
  hasCapacityForItem,
  inventoryContains,
  inventoryItems,
  inventoryStackCount,
  removeFromInventory,
  transferItem,
} from "../src/rules/utils/inventoryFacade.js";
import { weightDerivationSystem } from "../src/rules/systems/weightDerivationSystem.js";
import { defineInventoryVirtuals, getActorCarryVirtual, installVirtuals } from "../src/rules/utils/inventoryVirtuals.js";

function makeWorld() {
  return new World({ seed: 1 });
}

function makePlayer(world) {
  const id = world.create();
  world.add(id, Player);
  world.add(id, Inventory, { capacity: 20 });
  world.add(id, Position, { x: 0, y: 0 });
  return id;
}

function makeOwner(world, capacity = 10) {
  const id = world.create();
  world.add(id, Inventory, { capacity });
  return id;
}

function makeItem(world, { name = "Shard", identity = "shard", weight = 1, count = 1, unpaid = false } = {}) {
  const id = world.create();
  world.add(id, NamedIdentity, { name, identity });
  world.add(id, ItemInfo, { type: "misc", slot: "", weight, value: 0, description: "", count });
  world.add(id, Position, { x: 5, y: 5 });
  if (unpaid) world.add(id, Unpaid, { shopkeeperId: 7, price: 13 });
  return id;
}

function makeItemNoIdentity(world, { weight = 1, count = 1 } = {}) {
  const id = world.create();
  world.add(id, ItemInfo, { type: "misc", slot: "", weight, value: 0, description: "", count });
  return id;
}

Deno.test("facade: addToInventory creates inventory root for player", () => {
  const world = makeWorld();
  const player = makePlayer(world);
  const item = makeItem(world);

  assertEquals(findInventoryRoot(world, player), 0, "no root before first add");
  addToInventory(world, player, item);

  const root = findInventoryRoot(world, player);
  assert(root > 0, "root created");
  assert(world.has(root, InventoryRoot), "root has InventoryRoot tag");
  assertEquals(getParent(world, root), player, "root is child of player");
  assertEquals(getParent(world, item), root, "item is child of root");
});

Deno.test("facade: addToInventory creates inventory root for any owner with Inventory", () => {
  const world = makeWorld();
  const chest = makeOwner(world, 6);
  const item = makeItem(world);

  addToInventory(world, chest, item);

  const root = findInventoryRoot(world, chest);
  assert(root > 0, "root created");
  assertEquals(getParent(world, item), root, "item is child of owner root");
});

Deno.test("facade: second add reuses existing root", () => {
  const world = makeWorld();
  const owner = makeOwner(world);
  const a = makeItem(world, { identity: "a" });
  const b = makeItem(world, { identity: "b" });

  addToInventory(world, owner, a);
  const root1 = findInventoryRoot(world, owner);
  addToInventory(world, owner, b);
  const root2 = findInventoryRoot(world, owner);

  assertEquals(root1, root2, "same root reused");
});

Deno.test("facade: mutating operations migrate legacy direct-child inventories into a root", () => {
  const world = makeWorld();
  const owner = makeOwner(world);
  const legacy = makeItem(world, { identity: "legacy" });

  attachLegacyItem(world, owner, legacy);
  assertEquals(findInventoryRoot(world, owner), 0, "legacy layout starts without root");
  assertEquals(getParent(world, legacy), owner, "legacy item is direct child");

  const root = getOrCreateInventoryRoot(world, owner);
  assert(root > 0, "root created during migration");
  assertEquals(getParent(world, legacy), root, "legacy item migrated under root");
  assert(!world.has(legacy, Position), "migrated inventory item should not keep Position");
});

Deno.test("facade: addToInventory removes Position", () => {
  const world = makeWorld();
  const owner = makeOwner(world);
  const item = makeItem(world);

  assert(world.has(item, Position), "has position before");
  addToInventory(world, owner, item);
  assert(!world.has(item, Position), "position removed after add");
});

Deno.test("facade: inventoryContains works", () => {
  const world = makeWorld();
  const owner = makeOwner(world);
  const item = makeItem(world);

  assert(!inventoryContains(world, owner, item));
  addToInventory(world, owner, item);
  assert(inventoryContains(world, owner, item));
});

Deno.test("facade: removeFromInventory detaches", () => {
  const world = makeWorld();
  const owner = makeOwner(world);
  const item = makeItem(world);

  addToInventory(world, owner, item);
  assert(inventoryContains(world, owner, item));

  const ok = removeFromInventory(world, owner, item);
  assert(ok, "remove returned true");
  assert(!inventoryContains(world, owner, item));
  assert(!isChild(world, item), "item detached from hierarchy");
});

Deno.test("facade: removeFromInventory returns false for unknown item", () => {
  const world = makeWorld();
  const owner = makeOwner(world);
  const item = makeItem(world);
  assert(!removeFromInventory(world, owner, item));
});

Deno.test("facade: inventoryItems returns all items", () => {
  const world = makeWorld();
  const owner = makeOwner(world);
  const a = makeItem(world, { identity: "a" });
  const b = makeItem(world, { identity: "b" });
  const c = makeItem(world, { identity: "c" });

  addToInventory(world, owner, a);
  addToInventory(world, owner, b);
  addToInventory(world, owner, c);

  const items = inventoryItems(world, owner);
  assertEquals(items.length, 3);
  assert(items.includes(a));
  assert(items.includes(b));
  assert(items.includes(c));
});

Deno.test("facade: inventoryItems returns empty for no items", () => {
  const world = makeWorld();
  const owner = makeOwner(world);
  assertEquals(inventoryItems(world, owner).length, 0);
});

Deno.test("facade: addToInventory merges compatible stacks by default", () => {
  const world = makeWorld();
  const owner = makeOwner(world);
  const a = makeItem(world, { identity: "gold", count: 10 });
  const b = makeItem(world, { identity: "gold", count: 5 });

  addToInventory(world, owner, a);
  addToInventory(world, owner, b);

  assert(world.isAlive(a));
  assert(!world.isAlive(b));
  assertEquals(inventoryItems(world, owner).length, 1, "compatible stacks should coalesce into one entity");
  assertEquals(world.get(a, ItemInfo)?.count, 15, "counts should merge by default");
  assertEquals(inventoryStackCount(world, owner), 1, "one capacity stack");
});

Deno.test("facade: addToInventory respects mergeCompatible=false override", () => {
  const world = makeWorld();
  const owner = makeOwner(world);
  const a = makeItem(world, { identity: "ammo_fire_arrows", count: 3 });
  const b = makeItem(world, { identity: "ammo_fire_arrows", count: 2 });

  addToInventory(world, owner, a);
  addToInventory(world, owner, b, { mergeCompatible: false });

  assert(world.isAlive(a));
  assert(world.isAlive(b));
  assertEquals(inventoryItems(world, owner).length, 2, "explicit merge disable should keep distinct entities");
});

Deno.test("facade: getStackView groups by capacity-compatible stack key", () => {
  const world = makeWorld();
  const owner = makeOwner(world);
  const a = makeItem(world, { identity: "gold", count: 10 });
  const b = makeItem(world, { identity: "gold", count: 5 });
  const c = makeItem(world, { identity: "gold", count: 2, unpaid: true });

  addToInventory(world, owner, a);
  addToInventory(world, owner, b);
  addToInventory(world, owner, c);

  const view = getStackView(world, owner);
  assertEquals(view.size, 2, "paid and unpaid gold split into distinct groups");

  const paid = Array.from(view.values()).find((group) => group.unpaid == null);
  assert(paid, "paid stack exists");
  assertEquals(paid.totalCount, 15);

  const unpaid = Array.from(view.values()).find((group) => group.unpaid != null);
  assert(unpaid, "unpaid stack exists");
  assertEquals(unpaid.totalCount, 2);
});

Deno.test("facade: getStackCount aggregates raw identity totals", () => {
  const world = makeWorld();
  const owner = makeOwner(world);
  addToInventory(world, owner, makeItem(world, { identity: "gold", count: 10 }));
  addToInventory(world, owner, makeItem(world, { identity: "gold", count: 5, unpaid: true }));

  assertEquals(getStackCount(world, owner, "gold"), 15);
  assertEquals(getStackCount(world, owner, "sword"), 0);
});

Deno.test("facade: capacity counts distinct compatible stacks", () => {
  const world = makeWorld();
  const owner = makeOwner(world, 2);

  addToInventory(world, owner, makeItem(world, { identity: "gold", count: 10 }));
  addToInventory(world, owner, makeItem(world, { identity: "gold", count: 5 }));
  assert(hasCapacity(world, owner), "shared identity consumes one slot");

  addToInventory(world, owner, makeItem(world, { identity: "sword", count: 1 }));
  assert(!hasCapacity(world, owner), "two distinct stacks fill capacity");
});

Deno.test("facade: hasCapacityForItem allows compatible identity stack", () => {
  const world = makeWorld();
  const owner = makeOwner(world, 1);

  addToInventory(world, owner, makeItem(world, { identity: "gold", count: 10 }));
  assert(hasCapacityForItem(world, owner, makeItem(world, { identity: "gold", count: 5 })));
  assert(!hasCapacityForItem(world, owner, makeItem(world, { identity: "sword", count: 1 })));
});

Deno.test("facade: unpaid items do not bypass capacity by matching a paid stack", () => {
  const world = makeWorld();
  const owner = makeOwner(world, 1);

  addToInventory(world, owner, makeItem(world, { identity: "gold", count: 10 }));
  const unpaid = makeItem(world, { identity: "gold", count: 1, unpaid: true });

  assert(!hasCapacityForItem(world, owner, unpaid), "unpaid stack still needs its own slot");
});

Deno.test("facade: consumeFromStack detaches whole entities", () => {
  const world = makeWorld();
  const owner = makeOwner(world);
  const a = makeItem(world, { identity: "gold", count: 10 });
  const b = makeItem(world, { identity: "gold", count: 5 });

  addToInventory(world, owner, a);
  addToInventory(world, owner, b);

  const result = consumeFromStack(world, owner, "gold", 5);
  assertEquals(result.consumed, 5);
  assertEquals(result.entities.length, 1);
  assert(!inventoryContains(world, owner, result.entities[0]));
  assertEquals(getStackCount(world, owner, "gold"), 10);
});

Deno.test("facade: consumeFromStack splits partial entity", () => {
  const world = makeWorld();
  const owner = makeOwner(world);
  const a = makeItem(world, { identity: "gold", count: 10 });
  addToInventory(world, owner, a);

  const result = consumeFromStack(world, owner, "gold", 3);
  assertEquals(result.consumed, 3);
  assertEquals(result.entities.length, 1);
  assert(inventoryContains(world, owner, a));
  assertEquals(world.get(a, ItemInfo).count, 7);
  assertEquals(world.get(result.entities[0], ItemInfo).count, 3);
  assert(!inventoryContains(world, owner, result.entities[0]));
});

Deno.test("facade: consumeFromStack spans multiple entities", () => {
  const world = makeWorld();
  const owner = makeOwner(world);
  addToInventory(world, owner, makeItem(world, { identity: "gold", count: 3 }));
  addToInventory(world, owner, makeItem(world, { identity: "gold", count: 4 }));
  addToInventory(world, owner, makeItem(world, { identity: "gold", count: 5 }));

  const result = consumeFromStack(world, owner, "gold", 8);
  assertEquals(result.consumed, 8);
  assertEquals(getStackCount(world, owner, "gold"), 4);
});

Deno.test("facade: clearInventory detaches all items", () => {
  const world = makeWorld();
  const owner = makeOwner(world);
  addToInventory(world, owner, makeItem(world, { identity: "a" }));
  addToInventory(world, owner, makeItem(world, { identity: "b" }));
  addToInventory(world, owner, makeItem(world, { identity: "c" }));

  assertEquals(inventoryItems(world, owner).length, 3);
  clearInventory(world, owner);
  assertEquals(inventoryItems(world, owner).length, 0);
});

Deno.test("facade: transferItem moves between owners", () => {
  const world = makeWorld();
  const alice = makeOwner(world);
  const bob = makeOwner(world);
  const item = makeItem(world);

  addToInventory(world, alice, item);
  assert(inventoryContains(world, alice, item));
  assert(!inventoryContains(world, bob, item));

  transferItem(world, item, alice, bob);

  assert(!inventoryContains(world, alice, item));
  assert(inventoryContains(world, bob, item));
  assertEquals(getParent(world, item), findInventoryRoot(world, bob));
});

Deno.test("facade: forEachItem iterates all items", () => {
  const world = makeWorld();
  const owner = makeOwner(world);
  const a = makeItem(world, { identity: "a" });
  const b = makeItem(world, { identity: "b" });

  addToInventory(world, owner, a);
  addToInventory(world, owner, b);

  const seen = [];
  forEachItem(world, owner, (id) => seen.push(id));
  assertEquals(seen.length, 2);
  assert(seen.includes(a));
  assert(seen.includes(b));
});

Deno.test("facade: forEachItem early exit", () => {
  const world = makeWorld();
  const owner = makeOwner(world);
  addToInventory(world, owner, makeItem(world, { identity: "a" }));
  addToInventory(world, owner, makeItem(world, { identity: "b" }));
  addToInventory(world, owner, makeItem(world, { identity: "c" }));

  const seen = [];
  forEachItem(world, owner, (id) => {
    seen.push(id);
    return false;
  });
  assertEquals(seen.length, 1);
});

Deno.test("facade: weight derivation computes correct totals on the root", () => {
  const world = makeWorld();
  world.setScheduler((w) => weightDerivationSystem(w));

  const owner = makeOwner(world);
  const a = makeItem(world, { identity: "rock", weight: 5, count: 2 });
  const b = makeItem(world, { identity: "feather", weight: 0.1, count: 10 });

  addToInventory(world, owner, a);
  addToInventory(world, owner, b);
  world.tick(1);

  const wa = world.get(a, Weight);
  assert(wa);
  assertEquals(wa.self, 10);
  assertEquals(wa.total, 10);

  const root = findInventoryRoot(world, owner);
  const rootWeight = world.get(root, Weight);
  assert(rootWeight);
  assert(Math.abs(rootWeight.total - 11) < 0.001, `root total should be 11, got ${rootWeight.total}`);
});

Deno.test("facade: ActorCarry virtual returns the authoritative root total", () => {
  const world = makeWorld();
  installVirtuals(world);
  defineInventoryVirtuals(world);
  world.setScheduler((w) => weightDerivationSystem(w));

  const owner = makeOwner(world);
  addToInventory(world, owner, makeItem(world, { identity: "rock", weight: 5, count: 3 }));
  addToInventory(world, owner, makeItem(world, { identity: "gem", weight: 2, count: 1 }));
  world.tick(1);

  const ActorCarry = getActorCarryVirtual(world);
  const carry = world.vget(owner, ActorCarry);
  assert(Math.abs(carry.total - 17) < 0.001, `carry total should be 17, got ${carry.total}`);
});

Deno.test("facade: items without NamedIdentity each count as separate stack", () => {
  const world = makeWorld();
  const owner = makeOwner(world, 3);

  addToInventory(world, owner, makeItemNoIdentity(world));
  addToInventory(world, owner, makeItemNoIdentity(world));
  addToInventory(world, owner, makeItem(world, { identity: "gold" }));

  assertEquals(inventoryStackCount(world, owner), 3);
  assert(!hasCapacity(world, owner));
});

Deno.test("facade: addToInventory emits inventory:gold-gained for currency stacks", () => {
  const world = makeWorld();
  const owner = makeOwner(world);
  const events = [];
  world.on("inventory:gold-gained", (ev) => events.push(ev));
  const gold = makeItem(world, { identity: "gold", count: 12 });
  world.mutate(gold, ItemInfo, (rec) => { rec.type = "currency"; });

  addToInventory(world, owner, gold);

  assertEquals(events.length, 1);
  assertEquals(events[0].ownerId, owner);
  assertEquals(events[0].count, 12);
  assertEquals(events[0].merged, false);
});

Deno.test("facade: currency merge emits inventory:gold-gained with incoming count", () => {
  const world = makeWorld();
  const owner = makeOwner(world);
  const events = [];
  world.on("inventory:gold-gained", (ev) => events.push(ev));
  const a = makeItem(world, { identity: "gold", count: 8 });
  const b = makeItem(world, { identity: "gold", count: 5 });
  world.mutate(a, ItemInfo, (rec) => { rec.type = "currency"; });
  world.mutate(b, ItemInfo, (rec) => { rec.type = "currency"; });

  addToInventory(world, owner, a);
  addToInventory(world, owner, b);

  assertEquals(events.length, 2);
  assertEquals(events[0].count, 8);
  assertEquals(events[0].merged, false);
  assertEquals(events[1].count, 5);
  assertEquals(events[1].merged, true);
});

function attachLegacyItem(world, ownerId, itemId) {
  attach(world, itemId, ownerId);
}
