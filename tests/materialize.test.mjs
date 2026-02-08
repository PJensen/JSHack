import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { generateChunk } from '../src/rules/environment/dungeon/chunk.js';
import { materializeChunk } from '../src/rules/environment/dungeon/materialize.js';
import { CHUNK_SIZE, TILE_FLOOR, TILE_WALL, TILE_DOOR, TILE_VOID } from '../src/rules/environment/dungeon/constants.js';
import { Position } from '../src/rules/components/Position.js';
import { Terrain } from '../src/rules/components/Terrain.js';
import { DoorState } from '../src/rules/components/DoorState.js';
import { Collider } from '../src/rules/components/Collider.js';
import { Interactable } from '../src/rules/components/Interactable.js';

Deno.test("materializeChunk creates correct entity count", () => {
  const world = new World({ seed: 42 });
  const chunk = generateChunk(42, 1, 0, 0);

  // Count non-void tiles (doors count as 2 entities: floor + door)
  let expectedMin = 0;
  for (let i = 0; i < chunk.tiles.length; i++) {
    const t = chunk.tiles[i];
    if (t === TILE_FLOOR) expectedMin++;
    else if (t === TILE_WALL) expectedMin++;
    else if (t === TILE_DOOR) expectedMin += 2; // floor + door
  }

  const ids = materializeChunk(world, chunk);
  assert(ids.length === expectedMin, `entity count matches: expected ${expectedMin}, got ${ids.length}`);
});

Deno.test("materialized floor tiles have correct Position and Terrain", () => {
  const world = new World({ seed: 42 });
  const chunk = generateChunk(42, 1, 0, 0);
  const ids = materializeChunk(world, chunk);

  let floorCount = 0;
  for (const id of ids) {
    const pos = world.get(id, Position);
    const ter = world.get(id, Terrain);
    if (!ter) continue;
    if (ter.walkable && !world.has(id, DoorState)) {
      floorCount++;
      assert(Number.isInteger(pos.x) && Number.isInteger(pos.y), 'floor has integer pos');
      assert(ter.opaque === false, 'floor is not opaque');
    }
  }
  assert(floorCount > 0, 'has floor tiles');
});

Deno.test("materialized wall tiles are not walkable and are opaque", () => {
  const world = new World({ seed: 42 });
  const chunk = generateChunk(42, 1, 0, 0);
  materializeChunk(world, chunk);

  let wallCount = 0;
  for (const [id, pos] of world.query(Position)) {
    const ter = world.get(id, Terrain);
    if (ter && !ter.walkable && !world.has(id, DoorState)) {
      wallCount++;
      assert(ter.opaque === true, `wall at (${pos.x},${pos.y}) is opaque`);
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

  // Should match chunk.doors count
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
