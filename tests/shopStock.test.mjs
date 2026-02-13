import { assert } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createRng } from "../src/lib/ecs-js/rng.js";
import { generateShopItem } from "../src/rules/data/shopStock.js";
import { materializeSpawn } from "../src/rules/environment/dungeon/populate.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { Position } from "../src/rules/components/Position.js";

Deno.test("generateShopItem creates exactly one inventory-only item", () => {
  const world = new World({ seed: 123 });
  const rng = createRng(0xC0FFEE);

  const before = [...world.query(ItemInfo)].length;
  const itemId = generateShopItem(world, 5, rng);
  const after = [...world.query(ItemInfo)].length;

  assert(itemId != null, "shop item should be created");
  assert(after === before + 1, "only one item entity should be created");
  assert(world.has(itemId, ItemInfo), "created entity should be an item");
  assert(!world.has(itemId, Position), "shop stock item should not start on the floor");
});

Deno.test("shop_item spawn materializes one floor item without extra stock entities", () => {
  const world = new World({ seed: 123 });
  const before = [...world.query(ItemInfo)].length;

  const itemId = materializeSpawn(world, {
    x: 10,
    y: 10,
    kind: "shop_item",
    params: { depth: 4 },
  });
  const after = [...world.query(ItemInfo)].length;

  assert(itemId != null, "shop_item spawn should create an item");
  assert(after === before + 1, "shop_item spawn should create exactly one item entity");
  assert(world.has(itemId, Position), "shop_item should be placed on floor");
});
