import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Position } from "../src/rules/components/Position.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { Material } from "../src/rules/components/Material.js";
import { buildMagicItem } from "../src/rules/data/itemLoader.js";
import { materializeDrop } from "../src/rules/data/lootResolver.js";
import { createItemById } from "../src/rules/utils/itemFactory.js";

Deno.test("buildMagicItem applies material and charges from item defs", () => {
  const world = new World({ seed: 11 });
  const wandId = buildMagicItem(world, "wand_lightning");

  const mat = world.get(wandId, Material);
  const info = world.get(wandId, ItemInfo);
  assert(mat && mat.kind === "wood", "wand should carry wood material");
  assert(info, "wand should have item info");
  assertEquals(info.count, 3);
});

Deno.test("materializeDrop item path preserves material and placement", () => {
  const world = new World({ seed: 12 });
  const id = materializeDrop(
    world,
    { kind: "item", params: { itemId: "scroll_blastwave" } },
    { x: 4, y: 7 },
  );

  assert(id != null, "item drop should materialize");
  const mat = world.get(id, Material);
  const pos = world.get(id, Position);
  assert(mat && mat.kind === "paper", "scroll should carry paper material");
  assert(pos && pos.x === 4 && pos.y === 7, "drop should be placed at target tile");
});

Deno.test("createItemById routes magic items through materialized loader", () => {
  const world = new World({ seed: 13 });
  const id = createItemById(world, "book_meteor");
  assert(id != null, "book should be creatable");

  const mat = world.get(id, Material);
  assert(mat && mat.kind === "paper", "spellbook should carry paper material");
});

Deno.test("simple archetype items carry baseline materials", () => {
  const world = new World({ seed: 14 });

  const cases = [
    ["gold", "gold"],
    ["potion_health", "glass"],
    ["ammo_arrows", "wood"],
    ["scroll_mapping", "paper"],
  ];

  for (let i = 0; i < cases.length; i++) {
    const [itemId, expectedMaterial] = cases[i];
    const id = createItemById(world, itemId);
    assert(id != null, `expected item for ${itemId}`);
    const mat = world.get(id, Material);
    assert(mat && mat.kind === expectedMaterial, `${itemId} should use ${expectedMaterial}`);
  }
});
