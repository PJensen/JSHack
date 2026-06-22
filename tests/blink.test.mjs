import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Position } from "../src/rules/components/Position.js";
import { Status } from "../src/rules/components/Status.js";
import { runSpellScript } from "../src/rules/scripts/spells.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../src/rules/environment/dungeon/constants.js";
import { clearAll as clearTileMap, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";

const BLINK = { id: "blink", name: "Blink", manaCost: 6, range: 10, script: "blink" };

function loadFlatFloor() {
  clearTileMap();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  tiles.fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);
}

function makeActor(world, x, y) {
  const id = world.create();
  world.add(id, Position, { x, y });
  return id;
}

Deno.test("blink: targeted cast lands on requested tile", () => {
  loadFlatFloor();
  const world = new World({ seed: 0xC0FFEE });
  const actor = makeActor(world, 10, 10);
  const blinkEvents = [];
  world.on("spell:blink", (e) => blinkEvents.push(e));

  runSpellScript(world, actor, BLINK, { x: 15, y: 10 });

  const pos = world.get(actor, Position);
  assertEquals(pos.x, 15);
  assertEquals(pos.y, 10);
  assertEquals(blinkEvents.length, 1);
  assertEquals(blinkEvents[0].randomized, false);
});

Deno.test("blink: no target fails when caster is not disoriented", () => {
  loadFlatFloor();
  const world = new World({ seed: 0xC0FFEF });
  const actor = makeActor(world, 10, 10);
  const failures = [];
  world.on("spell:blink:failed", (e) => failures.push(e));

  runSpellScript(world, actor, BLINK, {});

  const pos = world.get(actor, Position);
  assertEquals(pos.x, 10);
  assertEquals(pos.y, 10);
  assertEquals(failures.length, 1);
  assertEquals(failures[0].reason, "no_target");
});

Deno.test("blink: confused caster ignores target and blinks in random direction", () => {
  loadFlatFloor();
  const world = new World({ seed: 0xB11E7 });
  const actor = makeActor(world, 10, 10);
  world.add(actor, Status, {
    statuses: [{ type: "confused", duration: 5, potency: 1, stacks: 1 }],
  });

  const blinkEvents = [];
  world.on("spell:blink", (e) => blinkEvents.push(e));

  runSpellScript(world, actor, BLINK, { x: 20, y: 10 });

  const pos = world.get(actor, Position);
  const dist = Math.max(Math.abs(pos.x - 10), Math.abs(pos.y - 10));
  assert(dist >= 1 && dist <= 10, `blink landed within range: ${dist}`);
  assertEquals(blinkEvents.length, 1);
  assertEquals(blinkEvents[0].randomized, true);
  assertEquals(blinkEvents[0].randomReason, "confused");
});

Deno.test("blink: out-of-range target fails", () => {
  loadFlatFloor();
  const world = new World({ seed: 0xD15EA5E });
  const actor = makeActor(world, 10, 10);
  const failures = [];
  world.on("spell:blink:failed", (e) => failures.push(e));

  runSpellScript(world, actor, BLINK, { x: 25, y: 10 });

  const pos = world.get(actor, Position);
  assertEquals(pos.x, 10);
  assertEquals(pos.y, 10);
  assertEquals(failures.length, 1);
  assertEquals(failures[0].reason, "out_of_range");
});

Deno.test("blink: hallucinating caster randomizes destination", () => {
  loadFlatFloor();
  const world = new World({ seed: 0xA77A77 });
  const actor = makeActor(world, 10, 10);
  world.add(actor, Status, {
    statuses: [{ type: "hallucination", duration: 4, potency: 1, stacks: 1 }],
  });

  const blinkEvents = [];
  world.on("spell:blink", (e) => blinkEvents.push(e));

  runSpellScript(world, actor, BLINK, { x: 20, y: 10 });

  const pos = world.get(actor, Position);
  const dist = Math.max(Math.abs(pos.x - 10), Math.abs(pos.y - 10));
  assert(dist >= 1 && dist <= 10, `blink landed within range: ${dist}`);
  assertEquals(blinkEvents.length, 1);
  assertEquals(blinkEvents[0].randomized, true);
  assertEquals(blinkEvents[0].randomReason, "hallucinating");
});
