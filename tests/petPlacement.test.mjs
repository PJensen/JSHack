import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { findNearestValidTileAround } from '../src/rules/utils/queries.js';
import { petBehaviorSystem } from '../src/rules/systems/petBehaviorSystem.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { loadChunk, clearAll } from '../src/rules/environment/dungeon/tileMap.js';
import { CHUNK_SIZE, TILE_FLOOR, TILE_WALL } from '../src/rules/environment/dungeon/constants.js';
import { Position } from '../src/rules/components/Position.js';
import { Player } from '../src/rules/components/Player.js';
import { Pet } from '../src/rules/components/Pet.js';
import { Collider } from '../src/rules/components/Collider.js';

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
  world.add(petId, Vitality, { hp: 10, maxHp: 10 });

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const blocker = world.create();
      world.add(blocker, Position, { x: 5 + dx, y: 5 + dy });
      world.add(blocker, Collider, { solid: true, blocksSight: false });
    }
  }

  petBehaviorSystem(world);

  const petPos = world.get(petId, Position);
  assertEquals(petPos, { x: 20, y: 20 });
  clearAll();
});
