import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Material } from "../src/rules/components/Material.js";
import { Potion } from "../src/rules/components/Potion.js";
import { Owner } from "../src/rules/components/Owner.js";
import { Position } from "../src/rules/components/Position.js";
import { createItemById } from "../src/rules/utils/itemFactory.js";
import { transmogrify } from "../src/rules/utils/transmogrify.js";

Deno.test("transmogrify changes identity while keeping same entity id", () => {
  const world = new World({ seed: 1 });
  const id = createItemById(world, "potion_health");
  assert(id != null);

  const result = transmogrify(world, id, "gold");
  assert(result.ok, "transmogrify should succeed");
  assertEquals(result.from, "potion_health");
  assertEquals(result.to, "gold");

  const ni = world.get(id, NamedIdentity);
  assertEquals(ni.identity, "gold");
  assertEquals(ni.name, "Gold");

  const info = world.get(id, ItemInfo);
  assertEquals(info.type, "currency");
});

Deno.test("transmogrify preserves entity id, position, and owner", () => {
  const world = new World({ seed: 2 });
  const id = createItemById(world, "gold");
  world.add(id, Position, { x: 5, y: 10 });
  world.add(id, Owner, { ownerId: 999 });

  const result = transmogrify(world, id, "potion_health");
  assert(result.ok);

  // Same entity id should still be alive with its positional data intact.
  assert(world.isAlive(id));
  const pos = world.get(id, Position);
  assertEquals(pos.x, 5);
  assertEquals(pos.y, 10);
  const owner = world.get(id, Owner);
  assertEquals(owner.ownerId, 999);
});

Deno.test("transmogrify strips type-specific components not on target", () => {
  const world = new World({ seed: 3 });
  const id = createItemById(world, "potion_health");
  assert(world.has(id, Potion), "health potion should have Potion component");

  // Turn the potion into gold — Potion component should be removed.
  transmogrify(world, id, "gold");
  assert(!world.has(id, Potion), "gold should not have Potion component");
});

Deno.test("transmogrify adds type-specific components the target needs", () => {
  const world = new World({ seed: 4 });
  const id = createItemById(world, "gold");
  assert(!world.has(id, Potion), "gold should not start with Potion");

  transmogrify(world, id, "potion_health");
  assert(world.has(id, Potion), "after transmogrify to potion, should have Potion");
});

Deno.test("transmogrify updates material", () => {
  const world = new World({ seed: 5 });
  const id = createItemById(world, "gold");
  assertEquals(world.get(id, Material)?.kind, "gold");

  transmogrify(world, id, "potion_health");
  assertEquals(world.get(id, Material)?.kind, "glass");
});

Deno.test("transmogrify returns ok:false for invalid target", () => {
  const world = new World({ seed: 6 });
  const id = createItemById(world, "gold");
  const result = transmogrify(world, id, "nonexistent_item_xyz");
  assert(!result.ok);
});

Deno.test("transmogrify returns ok:false for dead entity", () => {
  const world = new World({ seed: 7 });
  const id = createItemById(world, "gold");
  world.destroy(id);
  const result = transmogrify(world, id, "potion_health");
  assert(!result.ok);
});

Deno.test("transmogrify respects count override", () => {
  const world = new World({ seed: 8 });
  const id = createItemById(world, "gold");
  transmogrify(world, id, "ammo_arrows", { count: 25 });
  const info = world.get(id, ItemInfo);
  assertEquals(info.count, 25);
});
