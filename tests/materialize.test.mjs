import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { generateChunk } from '../src/rules/environment/dungeon/chunk.js';
import { materializeChunk } from '../src/rules/environment/dungeon/materialize.js';
import { CHUNK_SIZE, TILE_FLOOR, TILE_WALL, TILE_DOOR, TILE_VOID } from '../src/rules/environment/dungeon/constants.js';
import { Position } from '../src/rules/components/Position.js';
import { DoorState } from '../src/rules/components/DoorState.js';
import { Collider } from '../src/rules/components/Collider.js';
import { Interactable } from '../src/rules/components/Interactable.js';
import { loadChunk, clearAll, isWalkable, isOpaque } from '../src/rules/environment/dungeon/tileMap.js';

Deno.test("materializeChunk creates correct entity count (doors + spawns only)", () => {
  const world = new World({ seed: 42 });
  const chunk = generateChunk(42, 1, 0, 0);

  // Only doors create entities (no stair opts passed, spawns empty from generateChunk)
  let expectedDoors = 0;
  for (let i = 0; i < chunk.tiles.length; i++) {
    if (chunk.tiles[i] === TILE_DOOR) expectedDoors++;
  }

  const ids = materializeChunk(world, chunk);
  assert(ids.length === expectedDoors, `entity count matches doors: expected ${expectedDoors}, got ${ids.length}`);
});

Deno.test("tileMap reports floor tiles as walkable and non-opaque", () => {
  clearAll();
  const chunk = generateChunk(42, 1, 0, 0);
  loadChunk(0, 0, chunk.tiles);

  let floorCount = 0;
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      if (chunk.tiles[ly * CHUNK_SIZE + lx] === TILE_FLOOR) {
        floorCount++;
        assert(isWalkable(lx, ly), `floor at (${lx},${ly}) is walkable`);
        assert(!isOpaque(lx, ly), `floor at (${lx},${ly}) is not opaque`);
      }
    }
  }
  assert(floorCount > 0, 'has floor tiles');
});

Deno.test("tileMap reports wall tiles as not walkable and opaque", () => {
  clearAll();
  const chunk = generateChunk(42, 1, 0, 0);
  loadChunk(0, 0, chunk.tiles);

  let wallCount = 0;
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      if (chunk.tiles[ly * CHUNK_SIZE + lx] === TILE_WALL) {
        wallCount++;
        assert(!isWalkable(lx, ly), `wall at (${lx},${ly}) is not walkable`);
        assert(isOpaque(lx, ly), `wall at (${lx},${ly}) is opaque`);
      }
    }
  }
  assert(wallCount > 0, 'has wall tiles');
});

Deno.test("materialized doors have DoorState, Collider, and Interactable", () => {
  const world = new World({ seed: 42 });
  const chunk = generateChunk(42, 1, 0, 0);
  materializeChunk(world, chunk);

  let doorCount = 0;
  for (const [id] of world.query(DoorState)) {
    doorCount++;
    assert(world.has(id, Collider), 'door has Collider');
    assert(world.has(id, Interactable), 'door has Interactable');
    const col = world.get(id, Collider);
    assert(col.solid === true, 'door is solid when closed');
    const ds = world.get(id, DoorState);
    assert(ds.open === false, 'door starts closed');
  }

  assert(doorCount === chunk.doors.length, `door count matches: ${doorCount} vs ${chunk.doors.length}`);
});

Deno.test("materialized entities have world-space positions", () => {
  const cx = 3, cy = -2;
  const world = new World({ seed: 42 });
  const chunk = generateChunk(42, 1, cx, cy);
  const ids = materializeChunk(world, chunk);

  const ox = cx * CHUNK_SIZE;
  const oy = cy * CHUNK_SIZE;
  for (const id of ids) {
    const pos = world.get(id, Position);
    if (!pos) continue;
    assert(pos.x >= ox && pos.x < ox + CHUNK_SIZE, `pos.x in chunk range: ${pos.x}`);
    assert(pos.y >= oy && pos.y < oy + CHUNK_SIZE, `pos.y in chunk range: ${pos.y}`);
  }
});

Deno.test("materializeChunk returns trackable entity IDs", () => {
  const world = new World({ seed: 42 });
  const chunk = generateChunk(42, 1, 0, 0);
  const ids = materializeChunk(world, chunk);

  assert(Array.isArray(ids), 'returns array');
  assert(ids.length > 0, 'not empty');
  for (const id of ids) {
    assert(typeof id === 'number', 'IDs are numbers');
  }
});
