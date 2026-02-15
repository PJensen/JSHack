import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Position } from "../src/rules/components/Position.js";
import { Unpaid } from "../src/rules/components/Unpaid.js";
import { Player } from "../src/rules/components/Player.js";
import {
  addItemEntityToInventory,
  findInventoryStackTargetForItem,
} from "../src/rules/utils/inventoryStacking.js";

function makeStack(world, { identity, type = "misc", count = 1, x = null, y = null, unpaid = false }) {
  const id = world.create();
  world.add(id, NamedIdentity, { name: identity, identity });
  world.add(id, ItemInfo, { type, slot: "", weight: 0, value: 0, description: "", count });
  if (x != null && y != null) world.add(id, Position, { x, y });
  if (unpaid) world.add(id, Unpaid, { shopkeeperId: 1, price: 99 });
  return id;
}

Deno.test("inventory stacking helper coalesces existing duplicates while adding a new stack", () => {
  const world = new World({ seed: 1 });
  const actor = world.create();
  world.add(actor, Player, {});
  world.add(actor, Inventory, { items: [], capacity: 20, weightLimit: null });
  const inv = world.get(actor, Inventory);

  const a = makeStack(world, { identity: "gold", type: "currency", count: 5 });
  const b = makeStack(world, { identity: "gold", type: "currency", count: 7 });
  inv.items.push(a, b);

  const c = makeStack(world, { identity: "gold", type: "currency", count: 3, x: 2, y: 2 });
  const res = addItemEntityToInventory(world, inv, c);

  assert(res.ok, "add should succeed");
  assertEquals(res.mode, "stacked");
  assertEquals(inv.items.length, 1);
  const keep = inv.items[0];
  const info = world.get(keep, ItemInfo);
  assertEquals(info.count, 15);
  assert(!world.isAlive(b), "legacy duplicate stack should be merged away");
  assert(!world.isAlive(c), "incoming stack should merge and be destroyed");
});

Deno.test("inventory stacking helper does not merge unpaid items by default", () => {
  const world = new World({ seed: 2 });
  const actor = world.create();
  world.add(actor, Player, {});
  world.add(actor, Inventory, { items: [], capacity: 20, weightLimit: null });
  const inv = world.get(actor, Inventory);

  const paid = makeStack(world, { identity: "gold", type: "currency", count: 10 });
  inv.items.push(paid);

  const unpaid = makeStack(world, { identity: "gold", type: "currency", count: 2, unpaid: true });
  const res = addItemEntityToInventory(world, inv, unpaid);

  assert(res.ok, "add should succeed");
  assertEquals(res.mode, "added");
  assertEquals(inv.items.length, 2);
  assert(world.isAlive(unpaid), "unpaid stack should remain its own entity");
});

Deno.test("stack target detection allows capacity bypass when incoming item can merge", () => {
  const world = new World({ seed: 3 });
  const actor = world.create();
  world.add(actor, Player, {});
  world.add(actor, Inventory, { items: [], capacity: 1, weightLimit: null });
  const inv = world.get(actor, Inventory);

  const current = makeStack(world, { identity: "gold", type: "currency", count: 4 });
  inv.items.push(current);
  const incoming = makeStack(world, { identity: "gold", type: "currency", count: 6, x: 0, y: 0 });

  const target = findInventoryStackTargetForItem(world, inv, incoming);
  assertEquals(target, current);
});
