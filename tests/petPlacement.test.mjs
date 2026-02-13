import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { findNearestValidTileAround } from '../src/rules/utils/queries.js';
import { petFollowSystem } from '../src/rules/systems/petFollowSystem.js';
import { loadChunk, clearAll } from '../src/rules/environment/dungeon/tileMap.js';
import { CHUNK_SIZE, TILE_FLOOR, TILE_WALL } from '../src/rules/environment/dungeon/constants.js';
import { Position } from '../src/rules/components/Position.js';
import { Player } from '../src/rules/components/Player.js';
import { Pet } from '../src/rules/components/Pet.js';
import { Collider } from '../src/rules/components/Collider.js';
import { Inventory } from '../src/rules/components/Inventory.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';

function fillChunk(fill = TILE_FLOOR) {
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  tiles.fill(fill);
  return tiles;
}

Deno.test('findNearestValidTileAround finds valid spawn near walls', () => {
  clearAll();
  const tiles = fillChunk(TILE_WALL);
  tiles[1 * CHUNK_SIZE + 1] = TILE_FLOOR; // source tile
  tiles[2 * CHUNK_SIZE + 1] = TILE_FLOOR; // only valid adjacent tile (1,2)
  loadChunk(0, 0, tiles);

  const world = new World({ seed: 1 });
  const tile = findNearestValidTileAround(world, { x: 1, y: 1 }, {
    maxDistance: 1,
    exclude: [{ x: 1, y: 1 }],
  });

  assert(tile, 'expected a valid adjacent tile');
  assertEquals(tile, { x: 1, y: 2 });
  clearAll();
});

Deno.test('pet teleport keeps current position when nearby tiles are blocked', () => {
  clearAll();
  loadChunk(0, 0, fillChunk(TILE_FLOOR));

  const world = new World({ seed: 2 });
  const playerId = world.create();
  world.add(playerId, Player);
  world.add(playerId, Position, { x: 5, y: 5 });

  const petId = world.create();
  world.add(petId, Pet);
  world.add(petId, Position, { x: 20, y: 20 });

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const blocker = world.create();
      world.add(blocker, Position, { x: 5 + dx, y: 5 + dy });
      world.add(blocker, Collider, { solid: true, blocksSight: false });
    }
  }

  petFollowSystem(world);

  const petPos = world.get(petId, Position);
  assertEquals(petPos, { x: 20, y: 20 });
  clearAll();
});

Deno.test('pet delivery drops item on free adjacent tile when player tile is crowded', () => {
  clearAll();
  loadChunk(0, 0, fillChunk(TILE_FLOOR));

  const world = new World({ seed: 3 });
  const events = [];
  world.on('pet:deliver', (payload) => events.push(payload));

  const playerId = world.create();
  world.add(playerId, Player);
  world.add(playerId, Position, { x: 10, y: 10 });

  const petId = world.create();
  world.add(petId, Pet);
  world.add(petId, Position, { x: 9, y: 10 });
  world.add(petId, Inventory, { items: [] });

  const itemId = world.create();
  world.add(itemId, ItemInfo, { type: 'food', description: 'fish' });
  world.get(petId, Inventory).items.push(itemId);

  const blockedTiles = [
    { x: 9, y: 9 }, { x: 10, y: 9 }, { x: 11, y: 9 },
    { x: 9, y: 10 }, { x: 11, y: 10 },
    { x: 9, y: 11 }, { x: 11, y: 11 },
  ];
  for (const tile of blockedTiles) {
    const blocker = world.create();
    world.add(blocker, Position, tile);
    world.add(blocker, Collider, { solid: true, blocksSight: false });
  }

  petFollowSystem(world);

  const itemPos = world.get(itemId, Position);
  assertEquals(itemPos, { x: 10, y: 11 });
  assertEquals(world.get(petId, Inventory).items.length, 0);

  assertEquals(events.length, 1);
  assertEquals(events[0].mode, 'drop');
  assertEquals(events[0].autoTransferred, false);
  assertEquals(events[0].destination, { x: 10, y: 11 });
  clearAll();
});

Deno.test('pet delivery does not place item on player tile when no adjacent tile is available', () => {
  clearAll();
  loadChunk(0, 0, fillChunk(TILE_FLOOR));

  const world = new World({ seed: 4 });
  const playerId = world.create();
  world.add(playerId, Player);
  world.add(playerId, Position, { x: 8, y: 8 });

  const petId = world.create();
  world.add(petId, Pet);
  world.add(petId, Position, { x: 8, y: 9 });
  world.add(petId, Inventory, { items: [] });

  const itemId = world.create();
  world.add(itemId, ItemInfo, { type: 'food', description: 'treat' });
  world.get(petId, Inventory).items.push(itemId);

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const blocker = world.create();
      world.add(blocker, Position, { x: 8 + dx, y: 8 + dy });
      world.add(blocker, Collider, { solid: true, blocksSight: false });
    }
  }

  petFollowSystem(world);

  assert(!world.has(itemId, Position));
  assertEquals(world.get(petId, Inventory).items, [itemId]);
  clearAll();
});
