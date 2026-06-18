import { assert } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createRng } from "../src/lib/ecs-js/rng.js";
import { generateAlchemyShopItem, generateGemShopStock, generateShopItem } from "../src/rules/data/shopStock.js";
import { LOOT_TABLES } from "../src/rules/data/lootTables.js";
import { materializeSpawn } from "../src/rules/environment/dungeon/populate.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Position } from "../src/rules/components/Position.js";
import { Potion } from "../src/rules/components/Potion.js";

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

Deno.test("general shop equipment table can stock flint", () => {
  const entries = LOOT_TABLES["shop:equipment"]?.entries || [];
  assert(
    entries.some((entry) => entry.type === "item" && entry.itemId === "stone_flint"),
    "shop:equipment should include stone_flint as utility stock",
  );
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

Deno.test("alchemy shop floor items are potion stock without extra entities", () => {
  const world = new World({ seed: 321 });
  const rng = createRng(0xA11C0E);

  const itemId = generateAlchemyShopItem(world, rng);

  assert(itemId != null, "alchemy shop item should be created");
  assert(world.has(itemId, Potion), "alchemy shop stock should be potion-themed");
  assert(!world.has(itemId, Position), "alchemy shop stock should start inventory-only");
});

Deno.test("alchemy_shop_item spawn materializes one floor potion", () => {
  const world = new World({ seed: 321 });
  const before = [...world.query(ItemInfo)].length;

  const itemId = materializeSpawn(world, {
    x: 12,
    y: 9,
    kind: "alchemy_shop_item",
    params: {},
  });
  const after = [...world.query(ItemInfo)].length;

  assert(itemId != null, "alchemy_shop_item should create an item");
  assert(after === before + 1, "alchemy_shop_item should create exactly one item entity");
  assert(world.has(itemId, Position), "alchemy_shop_item should be placed on the floor");
  assert(world.has(itemId, Potion), "alchemy_shop_item should place a potion on the floor");
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

Deno.test("gem vendor stock surfaces multiple gemstone identities across seeds", () => {
  const seen = new Set();
  for (let seed = 1; seed <= 160; seed++) {
    const world = new World({ seed });
    const rng = createRng(seed * 97);
    const items = generateGemShopStock(world, rng);
    for (const itemId of items) {
      const identity = String(world.get(itemId, NamedIdentity)?.identity || "");
      if (!identity) continue;
      if (identity.startsWith("glass_") || identity.startsWith("stone_")) {
        throw new Error(`gem vendor stocked non-gemstone identity: ${identity}`);
      }
      if (identity.startsWith("gem_")) seen.add(identity);
    }
  }
  assert(seen.size > 1, `expected multiple gemstone identities in gem vendor stock, got ${Array.from(seen).join(", ") || "none"}`);
});
