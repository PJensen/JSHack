import { assert } from "jsr:@std/assert";
import {
  loadChunk, unloadChunk, clearAll,
  getTile, isWalkable, isOpaque,
  forEachTileInRect, loadedChunkCount,
} from '../src/rules/environment/dungeon/tileMap.js';
import {
  CHUNK_SIZE, TILE_VOID, TILE_FLOOR, TILE_WALL, TILE_DOOR,
  TILE_STAIR_DOWN, TILE_STAIR_UP,
} from '../src/rules/environment/dungeon/constants.js';

// Helper: create a chunk-sized Uint8Array filled with a value
function makeTiles(fill = TILE_VOID) {
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  tiles.fill(fill);
  return tiles;
}

Deno.test("getTile returns TILE_VOID for unloaded coordinates", () => {
  clearAll();
  assert(getTile(0, 0) === TILE_VOID);
  assert(getTile(100, 200) === TILE_VOID);
  assert(getTile(-5, -10) === TILE_VOID);
});

Deno.test("loadChunk and getTile round-trip", () => {
  clearAll();
  const tiles = makeTiles(TILE_FLOOR);
  tiles[0] = TILE_WALL; // (0,0) local
  tiles[5 * CHUNK_SIZE + 3] = TILE_DOOR; // local (3,5)
  loadChunk(0, 0, tiles);

  assert(getTile(0, 0) === TILE_WALL, 'wall at origin');
  assert(getTile(3, 5) === TILE_DOOR, 'door at (3,5)');
  assert(getTile(1, 0) === TILE_FLOOR, 'floor at (1,0)');
  assert(loadedChunkCount() === 1);
  clearAll();
});

Deno.test("unloadChunk removes data", () => {
  clearAll();
  loadChunk(1, 2, makeTiles(TILE_FLOOR));
  assert(loadedChunkCount() === 1);
  assert(getTile(CHUNK_SIZE, CHUNK_SIZE * 2) === TILE_FLOOR);

  unloadChunk(1, 2);
  assert(loadedChunkCount() === 0);
  assert(getTile(CHUNK_SIZE, CHUNK_SIZE * 2) === TILE_VOID);
});

Deno.test("clearAll removes all chunks", () => {
  clearAll();
  loadChunk(0, 0, makeTiles(TILE_FLOOR));
  loadChunk(1, 0, makeTiles(TILE_WALL));
  loadChunk(0, 1, makeTiles(TILE_DOOR));
  assert(loadedChunkCount() === 3);

  clearAll();
  assert(loadedChunkCount() === 0);
});

Deno.test("isWalkable returns correct values for each tile type", () => {
  clearAll();
  const tiles = makeTiles(TILE_VOID);
  tiles[0] = TILE_VOID;
  tiles[1] = TILE_FLOOR;
  tiles[2] = TILE_WALL;
  tiles[3] = TILE_DOOR;
  tiles[4] = TILE_STAIR_DOWN;
  tiles[5] = TILE_STAIR_UP;
  loadChunk(0, 0, tiles);

  assert(!isWalkable(0, 0), 'VOID not walkable');
  assert(isWalkable(1, 0), 'FLOOR walkable');
  assert(!isWalkable(2, 0), 'WALL not walkable');
  assert(isWalkable(3, 0), 'DOOR walkable');
  assert(isWalkable(4, 0), 'STAIR_DOWN walkable');
  assert(isWalkable(5, 0), 'STAIR_UP walkable');
  clearAll();
});

Deno.test("isOpaque returns correct values for each tile type", () => {
  clearAll();
  const tiles = makeTiles(TILE_VOID);
  tiles[0] = TILE_VOID;
  tiles[1] = TILE_FLOOR;
  tiles[2] = TILE_WALL;
  tiles[3] = TILE_DOOR;
  tiles[4] = TILE_STAIR_DOWN;
  tiles[5] = TILE_STAIR_UP;
  loadChunk(0, 0, tiles);

  assert(!isOpaque(0, 0), 'VOID not opaque');
  assert(!isOpaque(1, 0), 'FLOOR not opaque');
  assert(isOpaque(2, 0), 'WALL opaque');
  assert(!isOpaque(3, 0), 'DOOR not opaque');
  assert(!isOpaque(4, 0), 'STAIR_DOWN not opaque');
  assert(!isOpaque(5, 0), 'STAIR_UP not opaque');
  clearAll();
});

Deno.test("negative coordinates work correctly", () => {
  clearAll();
  const tiles = makeTiles(TILE_FLOOR);
  tiles[10 * CHUNK_SIZE + 15] = TILE_WALL; // local (15,10)
  loadChunk(-1, -1, tiles);

  const wx = -CHUNK_SIZE + 15;
  const wy = -CHUNK_SIZE + 10;
  assert(getTile(wx, wy) === TILE_WALL, `wall at (${wx},${wy})`);
  assert(getTile(-CHUNK_SIZE, -CHUNK_SIZE) === TILE_FLOOR, 'floor at chunk origin');
  clearAll();
});

Deno.test("forEachTileInRect iterates visible tiles", () => {
  clearAll();
  const tiles = makeTiles(TILE_FLOOR);
  tiles[0] = TILE_WALL;
  loadChunk(0, 0, tiles);

  const visited = [];
  forEachTileInRect(0, 0, 2, 2, (x, y, tile) => {
    visited.push({ x, y, tile });
  });

  assert(visited.length === 9, `3x3 rect = 9 tiles, got ${visited.length}`);
  assert(visited[0].tile === TILE_WALL, 'first tile is wall');
  assert(visited[1].tile === TILE_FLOOR, 'second tile is floor');
  clearAll();
});

Deno.test("forEachTileInRect skips void tiles", () => {
  clearAll();
  // No chunks loaded — everything is TILE_VOID
  const visited = [];
  forEachTileInRect(0, 0, 5, 5, (x, y, tile) => {
    visited.push({ x, y, tile });
  });
  assert(visited.length === 0, 'no tiles visited when all void');
});

Deno.test("chunk boundary math is correct", () => {
  clearAll();
  const tilesA = makeTiles(TILE_FLOOR);
  const tilesB = makeTiles(TILE_WALL);
  loadChunk(0, 0, tilesA);
  loadChunk(1, 0, tilesB);

  // Last tile of chunk (0,0) should be floor
  assert(getTile(CHUNK_SIZE - 1, 0) === TILE_FLOOR, 'last tile of chunk 0 is floor');
  // First tile of chunk (1,0) should be wall
  assert(getTile(CHUNK_SIZE, 0) === TILE_WALL, 'first tile of chunk 1 is wall');
  clearAll();
});
