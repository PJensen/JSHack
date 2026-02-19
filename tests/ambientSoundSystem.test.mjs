import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { RoomMetadata } from "../src/rules/components/RoomMetadata.js";
import { ambientSoundSystem } from "../src/rules/systems/ambientSoundSystem.js";

/**
 * @param {number} seed
 * @param {number} step
 */
function runAmbientOnce(seed, step) {
  const world = new World({ seed });
  world.step = step | 0;

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
  ambientSoundSystem(world);
  return events[0] || null;
}

Deno.test("ambientSoundSystem is deterministic for same seed + step + layout", () => {
  const a = runAmbientOnce(8111, 42);
  const b = runAmbientOnce(8111, 42);
  assert(a && b, "ambient events should exist");
  assertEquals(a.text, b.text);
  assertEquals(a.source, "shop");
  assertEquals(b.source, "shop");
});

Deno.test("ambientSoundSystem respects per-location cooldown across turns", () => {
  const world = new World({ seed: 8112 });

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
  ambientSoundSystem(world);
  assertEquals(events.length, 1, "first notification should emit");

  for (let turn = 1; turn < 10; turn++) {
    world.step = turn;
    ambientSoundSystem(world);
  }
  assertEquals(events.length, 1, "cooldown should suppress duplicate notifications");

  world.step = 10;
  ambientSoundSystem(world);
  assertEquals(events.length, 2, "notification should resume after cooldown window");
});
