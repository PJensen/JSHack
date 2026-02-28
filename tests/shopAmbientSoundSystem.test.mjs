import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { RoomMetadata } from "../src/rules/components/RoomMetadata.js";
import { shopAmbientSoundSystem } from "../src/rules/systems/shopAmbientSoundSystem.js";

/**
 * @param {number} seed
 * @param {number} step
 */
function runAmbientOnce(seed, step) {
  const world = new World({ seed });
  world.step = step | 0;
  const dungeonId = world.create();
  world.add(dungeonId, DungeonState, { worldSeed: seed >>> 0, currentDepth: 3, floorEntityIds: [] });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 4, y: 4 });

  const shop = world.create();
  world.add(shop, RoomMetadata, {
    roomType: "shop",
    x: 3,
    y: 3,
    w: 4,
    h: 4,
    shopkeeperId: 0,
  });

  const events = [];
  world.on("ambient:sound", (ev) => events.push(ev));
  shopAmbientSoundSystem(world);
  return events[0] || null;
}

Deno.test("shopAmbientSoundSystem is deterministic for same seed + step + layout", () => {
  const a = runAmbientOnce(8111, 42);
  const b = runAmbientOnce(8111, 42);
  assert(a && b, "ambient events should exist");
  assertEquals(a.clarity, b.clarity);
  assertEquals(a.source, "shop");
  assertEquals(a.depth, 3);
  assertEquals(a.sourceDbAt1Tile, 60);
  assert(a.at && Number.isFinite(a.at.x) && Number.isFinite(a.at.y), "sound should include source location");
  assertEquals(b.source, "shop");
});

Deno.test("shopAmbientSoundSystem respects per-location cooldown across turns", () => {
  const world = new World({ seed: 8112 });
  const dungeonId = world.create();
  world.add(dungeonId, DungeonState, { worldSeed: 8112, currentDepth: 2, floorEntityIds: [] });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 4, y: 4 });

  const shop = world.create();
  world.add(shop, RoomMetadata, {
    roomType: "shop",
    x: 3,
    y: 3,
    w: 4,
    h: 4,
    shopkeeperId: 0,
  });

  const events = [];
  world.on("ambient:sound", (ev) => events.push(ev));

  world.step = 0;
  shopAmbientSoundSystem(world);
  assertEquals(events.length, 1, "first notification should emit");

  for (let turn = 1; turn < 10; turn++) {
    world.step = turn;
    shopAmbientSoundSystem(world);
  }
  assertEquals(events.length, 1, "cooldown should suppress duplicate notifications");

  world.step = 10;
  shopAmbientSoundSystem(world);
  assertEquals(events.length, 2, "notification should resume after cooldown window");
});
