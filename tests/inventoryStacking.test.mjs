import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Position } from "../src/rules/components/Position.js";
import { Unpaid } from "../src/rules/components/Unpaid.js";
import { Player } from "../src/rules/components/Player.js";
import { addToInventory, inventoryItems, hasCapacityForItem } from "../src/rules/utils/inventoryFacade.js";

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

  const a = makeStack(world, { identity: "gold", type: "currency", count: 5 });
  const b = makeStack(world, { identity: "gold", type: "currency", count: 7 });
  addToInventory(world, actor, a);
  addToInventory(world, actor, b);

  const c = makeStack(world, { identity: "gold", type: "currency", count: 3, x: 2, y: 2 });
  const res = addToInventory(world, actor, c);

  assert(res, "add should succeed");
  const items = inventoryItems(world, actor);
  assertEquals(items.length, 1);
  let totalCount = 0;
  for (const id of items) totalCount += world.get(id, ItemInfo).count;
  assertEquals(totalCount, 15);
});

Deno.test("inventory stacking helper does not merge unpaid items by default", () => {
  const world = new World({ seed: 2 });
  const actor = world.create();
  world.add(actor, Player, {});
  world.add(actor, Inventory, { items: [], capacity: 20, weightLimit: null });

  const paid = makeStack(world, { identity: "gold", type: "currency", count: 10 });
  addToInventory(world, actor, paid);

  const unpaid = makeStack(world, { identity: "gold", type: "currency", count: 2, unpaid: true });
  const res = addToInventory(world, actor, unpaid);

  assert(res, "add should succeed");
  assertEquals(inventoryItems(world, actor).length, 2);
  assert(world.isAlive(unpaid), "unpaid stack should remain its own entity");
});

Deno.test("stack target detection allows capacity bypass when incoming item can merge", () => {
  const world = new World({ seed: 3 });
  const actor = world.create();
  world.add(actor, Player, {});
  world.add(actor, Inventory, { items: [], capacity: 1, weightLimit: null });

  const current = makeStack(world, { identity: "gold", type: "currency", count: 4 });
  addToInventory(world, actor, current);
  const incoming = makeStack(world, { identity: "gold", type: "currency", count: 6, x: 0, y: 0 });

  const canFit = hasCapacityForItem(world, actor, incoming);
  assert(canFit, "incoming item sharing identity should bypass capacity limit");
});
