import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { spawnMonsterEntity } from "../src/rules/utils/spawnMonsterEntity.js";
import { Facing } from "../src/rules/components/Facing.js";
import { MoveIntent } from "../src/rules/components/Intents/MoveIntent.js";
import { Position } from "../src/rules/components/Position.js";
import { movementSystem } from "../src/rules/systems/movementSystem.js";
import { setFacingTurnCostEnabled } from "../src/rules/utils/facing.js";
import { loadChunk, clearAll } from "../src/rules/environment/dungeon/tileMap.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../src/rules/environment/dungeon/constants.js";

function loadFloorChunk() {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);
}

Deno.test("spawnMonsterEntity: monsters include Facing by default", () => {
  loadFloorChunk();
  try {
    const world = new World({ seed: 0xC0FFEE });
    const id = spawnMonsterEntity(world, { identity: "goblin", x: 5, y: 5 });
    const facing = world.get(id, Facing);
    assert(facing, "monster should have Facing component");
    assertEquals(facing.dx, 0);
    assertEquals(facing.dy, 0);
  } finally {
    clearAll();
  }
});

Deno.test("movementSystem: monster facing updates on move attempt", () => {
  loadFloorChunk();
  try {
    const world = new World({ seed: 0xA77A77 });
    const id = spawnMonsterEntity(world, { identity: "goblin", x: 7, y: 7 });
    world.add(id, MoveIntent, { dx: -1, dy: 1 });

    movementSystem(world);

    const facing = world.get(id, Facing);
    assert(facing, "monster should keep Facing component");
    assertEquals(facing.dx, -1);
    assertEquals(facing.dy, 1);

    const pos = world.get(id, Position);
    assertEquals(pos.x, 6);
    assertEquals(pos.y, 8);
  } finally {
    clearAll();
  }
});

Deno.test("movementSystem: monsters spend a turn to reorient when facing turn cost is enabled", () => {
  loadFloorChunk();
  try {
    const world = new World({ seed: 0xBEEF });
    setFacingTurnCostEnabled(world, true);
    const id = spawnMonsterEntity(world, { identity: "goblin", x: 7, y: 7 });
    world.add(id, Facing, { dx: 1, dy: 0 });
    world.add(id, MoveIntent, { dx: -1, dy: 0 });

    movementSystem(world);

    const facing = world.get(id, Facing);
    const pos = world.get(id, Position);
    assertEquals(facing.dx, -1);
    assertEquals(facing.dy, 0);
    assertEquals(pos.x, 7, "monster should stay in place while turning");
    assertEquals(pos.y, 7, "monster should stay in place while turning");
  } finally {
    clearAll();
  }
});
