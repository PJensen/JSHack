import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Brain } from "../src/rules/components/Brain.js";
import { Collider } from "../src/rules/components/Collider.js";
import { Faction } from "../src/rules/components/Faction.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { nearestPerceivedHostile, perceiveEntity } from "../src/rules/utils/perception.js";
import { clearAll, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";
import { CHUNK_SIZE, TILE_FLOOR, TILE_WALL } from "../src/rules/environment/dungeon/constants.js";

function makeWorld() {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  tiles.fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);
  return new World({ seed: 7 });
}

function actor(world, x, y, faction = "townfolk", visionRange = 8) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Faction, { key: faction });
  world.add(id, Brain, { visionRange, intelligence: 10 });
  return id;
}

function target(world, x, y, faction = "enemy", hp = 5) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Faction, { key: faction });
  world.add(id, Vitality, { hp, maxHp: 5 });
  return id;
}

Deno.test("perceiveEntity requires observer Brain", () => {
  const world = makeWorld();
  const observer = world.create();
  world.add(observer, Position, { x: 1, y: 1 });
  world.add(observer, Faction, { key: "townfolk" });
  const enemy = target(world, 2, 1);

  assertEquals(perceiveEntity(world, observer, enemy), null);
});

Deno.test("perceiveEntity respects effective Brain vision range", () => {
  const world = makeWorld();
  const observer = actor(world, 1, 1, "townfolk", 1);
  const enemy = target(world, 3, 1);

  assertEquals(perceiveEntity(world, observer, enemy), null);

  world.mutate(observer, Brain, (brain) => {
    brain.visionRange = 2;
  });
  assert(perceiveEntity(world, observer, enemy), "target at range 2 should be visible with visionRange 2");
});

Deno.test("perceiveEntity respects LOS blockers", () => {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  tiles.fill(TILE_FLOOR);
  tiles[1 * CHUNK_SIZE + 2] = TILE_WALL;
  loadChunk(0, 0, tiles);
  const world = new World({ seed: 8 });
  const observer = actor(world, 1, 1);
  const enemy = target(world, 3, 1);

  assertEquals(perceiveEntity(world, observer, enemy), null);
});

Deno.test("nearestPerceivedHostile respects faction hostility and dead targets", () => {
  const world = makeWorld();
  const observer = actor(world, 1, 1, "townfolk", 8);
  const unfactioned = world.create();
  world.add(unfactioned, Position, { x: 2, y: 2 });
  target(world, 2, 1, "neutral");
  target(world, 3, 1, "enemy", 0);
  const enemy = target(world, 4, 1, "enemy", 5);

  const seen = nearestPerceivedHostile(world, observer);
  assertEquals(seen?.id, enemy);
  assert(unfactioned > 0, "unfactioned entity exists and should not be treated as a hostile");
});

Deno.test("nearestPerceivedHostile picks nearest visible hostile", () => {
  const world = makeWorld();
  const observer = actor(world, 1, 1, "townfolk", 8);
  const far = target(world, 6, 1, "enemy", 5);
  const near = target(world, 2, 1, "enemy", 5);

  const seen = nearestPerceivedHostile(world, observer);
  assertEquals(seen?.id, near);
  assert(far > 0, "far hostile exists");
});
