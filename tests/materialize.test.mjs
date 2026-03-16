import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { generateChunk } from '../src/rules/environment/dungeon/chunk.js';
import { materializeChunk } from '../src/rules/environment/dungeon/materialize.js';
import { materializeSpawn } from '../src/rules/environment/dungeon/populate.js';
import { CHUNK_SIZE, TILE_FLOOR, TILE_WALL, TILE_DOOR, TILE_VOID } from '../src/rules/environment/dungeon/constants.js';
import { Position } from '../src/rules/components/Position.js';
import { DoorState } from '../src/rules/components/DoorState.js';
import { Collider } from '../src/rules/components/Collider.js';
import { Interactable } from '../src/rules/components/Interactable.js';
import { Inventory } from '../src/rules/components/Inventory.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { RoomMetadata } from '../src/rules/components/RoomMetadata.js';
import { Unpaid } from '../src/rules/components/Unpaid.js';
import { loadChunk, clearAll, isWalkable, isOpaque } from '../src/rules/environment/dungeon/tileMap.js';
import { inventoryItems } from '../src/rules/utils/inventoryFacade.js';

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

Deno.test("potion shelves and gem display cases act like stocked rack-style containers in shop rooms", () => {
  const world = new World({ seed: 42 });
  const roomEntity = world.create();
  world.add(roomEntity, RoomMetadata, {
    roomType: 'shop',
    x: 1,
    y: 1,
    w: 8,
    h: 8,
    shopkeeperId: 9001,
  });

  const chunk = {
    chunkX: 0,
    chunkY: 0,
    depth: 0,
    seed: 42,
    tiles: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_VOID),
    rooms: [],
    doors: [],
    spawns: [
      { x: 2, y: 2, kind: 'potion_shelf', params: {} },
      { x: 4, y: 2, kind: 'gem_display_case', params: {} },
    ],
  };

  materializeChunk(world, chunk);

  const found = new Map();
  for (const [id, inv, pos, named] of world.query(Inventory, Position, NamedIdentity)) {
    if (String(named.identity) !== 'potion_shelf' && String(named.identity) !== 'gem_display_case') continue;
    assert(world.has(id, Interactable), `${named.identity} should be interactable`);
    const items = inventoryItems(world, id);
    assert(items.length > 0, `${named.identity} should start stocked`);
    for (const itemId of items) {
      const unpaid = world.get(itemId, Unpaid);
      assert(unpaid, `${named.identity} stock should be marked unpaid in shop rooms`);
      assert(unpaid.shopkeeperId === 9001, `${named.identity} stock should belong to the room's shopkeeper`);
    }
    found.set(String(named.identity), items.length);
  }

  assert(found.has('potion_shelf'), 'expected a potion shelf');
  assert(found.has('gem_display_case'), 'expected a gem display case');
});

Deno.test("gem display case can be authored to stock rare or epic gems", () => {
  const world = new World({ seed: 42 });
  const id = materializeSpawn(world, {
    x: 4,
    y: 2,
    kind: 'gem_display_case',
    params: { stockTier: 'rare_or_epic' },
  });

  assert(id != null, "expected gem display case to materialize");
  const items = inventoryItems(world, id);
  assert(items.length > 0, "expected authored gem display case to start stocked");
  for (const itemId of items) {
    const info = world.get(itemId, ItemInfo);
    assert(info, "expected stocked gem to have item info");
    assert(info.value >= 1500, `expected rare-or-epic gem value, got ${info.value}`);
  }
});
