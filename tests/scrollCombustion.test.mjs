import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { Material } from "../src/rules/components/Material.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Position } from "../src/rules/components/Position.js";
import { Status } from "../src/rules/components/Status.js";
import { materialReactionSystem } from "../src/rules/systems/materialReactionSystem.js";
import { createItemById } from "../src/rules/utils/itemFactory.js";
import { addToInventory } from "../src/rules/utils/inventoryFacade.js";

Deno.test("burning status combusts scrolls on tile into ash", () => {
  const world = new World({ seed: 21 });
  const transforms = [];
  world.on("item:transformed", (e) => transforms.push(e));

  const scrollId = createItemById(world, "scroll_blastwave");
  assert(scrollId != null, "scroll item should be created");
  world.add(scrollId, Position, { x: 10, y: 10 });

  const burner = world.create();
  world.add(burner, Position, { x: 10, y: 10 });
  world.add(burner, Status, { statuses: [{ type: "burning", duration: 2, potency: 1, stacks: 1 }] });

  world.step = 7;
  materialReactionSystem(world);

  const info = world.get(scrollId, ItemInfo);
  const mat = world.get(scrollId, Material);
  const ni = world.get(scrollId, NamedIdentity);

  assert(info, "scroll should still have item info");
  assertEquals(info.type, "junk");
  assertEquals(info.description, "A small pile of ash.");
  assert(mat, "ash should still carry material");
  assertEquals(mat.kind, "sand");
  assert(ni, "ash should have identity");
  assertEquals(ni.identity, "ash");
  assertEquals(transforms.length, 1);
  assertEquals(transforms[0]?.source, burner);
  assertEquals(transforms[0]?.cause, "burning");
  assertEquals(transforms[0]?.scope, "ground");
  assertEquals(transforms[0]?.ownerId, null);
  assertEquals(transforms[0]?.from?.identity, "scroll_blastwave");
  assertEquals(transforms[0]?.to?.identity, "ash");
});

Deno.test("non-burning entities do not trigger reactions", () => {
  const world = new World({ seed: 22 });

  const bookId = createItemById(world, "book_meteor");
  const scrollId = createItemById(world, "scroll_blastwave");
  assert(bookId != null && scrollId != null, "items should be created");
  world.add(bookId, Position, { x: 5, y: 5 });
  world.add(scrollId, Position, { x: 5, y: 5 });

  const notBurning = world.create();
  world.add(notBurning, Position, { x: 5, y: 5 });
  world.add(notBurning, Status, { statuses: [{ type: "poisoned", duration: 2, potency: 1, stacks: 1 }] });

  materialReactionSystem(world);

  const bookName = world.get(bookId, NamedIdentity);
  const bookInfo = world.get(bookId, ItemInfo);
  const scrollName = world.get(scrollId, NamedIdentity);
  const scrollInfo = world.get(scrollId, ItemInfo);

  assertEquals(bookName.identity, "book_meteor");
  assertEquals(bookInfo.type, "learn");
  assertEquals(scrollName.identity, "scroll_blastwave");
  assertEquals(scrollInfo.type, "scroll");
});

Deno.test("burning status combusts carried scrolls in inventory", () => {
  const world = new World({ seed: 23 });
  const transforms = [];
  world.on("item:transformed", (e) => transforms.push(e));

  const carrier = world.create();
  world.add(carrier, Position, { x: 2, y: 3 });
  world.add(carrier, Status, { statuses: [{ type: "burning", duration: 3, potency: 1, stacks: 1 }] });
  world.add(carrier, Inventory, { items: [] });

  const carriedScroll = createItemById(world, "scroll_blastwave");
  assert(carriedScroll != null, "carried scroll should exist");
  addToInventory(world, carrier, carriedScroll);

  materialReactionSystem(world);

  const ni = world.get(carriedScroll, NamedIdentity);
  const info = world.get(carriedScroll, ItemInfo);
  const mat = world.get(carriedScroll, Material);

  assertEquals(ni.identity, "ash");
  assertEquals(info.type, "junk");
  assertEquals(mat.kind, "sand");
  assertEquals(transforms.length, 1);
  assertEquals(transforms[0]?.source, carrier);
  assertEquals(transforms[0]?.scope, "inventory");
  assertEquals(transforms[0]?.ownerId, carrier);
  assertEquals(transforms[0]?.from?.identity, "scroll_blastwave");
  assertEquals(transforms[0]?.to?.identity, "ash");
});
