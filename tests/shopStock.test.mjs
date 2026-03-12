import { assert } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createRng } from "../src/lib/ecs-js/rng.js";
import { generateGemShopStock, generateShopItem } from "../src/rules/data/shopStock.js";
import { materializeSpawn } from "../src/rules/environment/dungeon/populate.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
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

Deno.test("gem vendor stock is pre-identified and carries gem detail metadata", () => {
  const world = new World({ seed: 456 });
  const rng = createRng(0xA77A77);

  const items = generateGemShopStock(world, rng);

  assert(items.length > 0, "gem vendor should stock items");
  for (const itemId of items) {
    const info = world.get(itemId, ItemInfo);
    const identity = String(world.get(itemId, NamedIdentity)?.identity || "");
    assert(info, "gem vendor stock item should have ItemInfo");
    assert(info.type === "gem", "gem vendor should only stock gems");
    assert(info.identified === true, "all gem vendor stock should be pre-identified");
    assert(typeof info.appearance === "string" && info.appearance.length > 0, "gems should retain an appearance string");
    if (identity.startsWith("gem_")) {
      assert(Array.isArray(info.detailLines), "gems should expose detail lines for the shop tooltip");
    }
  }
});
