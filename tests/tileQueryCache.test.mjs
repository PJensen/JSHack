import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { getLivingEntityAt, getItemsAt, forEachAt, invalidateTileQueryCache } from "../src/rules/utils/tileQueryCache.js";

Deno.test("tileQueryCache: living and item lookups by tile", () => {
  const world = new World({ seed: 7 });

  const living = world.create();
  world.add(living, Position, { x: 3, y: 4 });
  world.add(living, Vitality, { hp: 5, maxHp: 5 });

  const dead = world.create();
  world.add(dead, Position, { x: 3, y: 4 });
  world.add(dead, Vitality, { hp: 0, maxHp: 5 });

  const item = world.create();
  world.add(item, Position, { x: 3, y: 4 });
  world.add(item, ItemInfo, { type: "currency", count: 1 });

  assertEquals(getLivingEntityAt(world, 3, 4), living);
  const items = getItemsAt(world, 3, 4);
  assert(items.includes(item), "expected item lookup to include item on tile");

  const seen = [];
  forEachAt(world, 3, 4, (id) => seen.push(id));
  assert(seen.includes(living), "forEachAt should include living entity");
  assert(seen.includes(item), "forEachAt should include item entity");
});

Deno.test("tileQueryCache: invalidate enables same-tick position updates", () => {
  const world = new World({ seed: 11 });

  const item = world.create();
  world.add(item, Position, { x: 1, y: 1 });
  world.add(item, ItemInfo, { type: "currency", count: 1 });

  // Build cache for this step.
  assert(getItemsAt(world, 1, 1).includes(item), "expected item at initial tile");

  // Move without advancing world.step; cache is stale until invalidated.
  world.set(item, Position, { x: 2, y: 2 });
  assertEquals(getItemsAt(world, 2, 2).includes(item), false);

  invalidateTileQueryCache(world);
  assert(getItemsAt(world, 2, 2).includes(item), "expected item at moved tile after invalidate");
});

