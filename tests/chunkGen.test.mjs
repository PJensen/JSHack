import { assert } from "jsr:@std/assert";
import { createRng } from '../src/lib/ecs-js/rng.js';
import { generateChunk, edgeGate, findDoorPositions, isDoorFrameAt, sanitizeDoorTiles } from '../src/rules/environment/dungeon/chunk.js';
import { CHUNK_SIZE, TILE_VOID, TILE_FLOOR, TILE_WALL, TILE_DOOR } from '../src/rules/environment/dungeon/constants.js';
import { dungeonConfig } from '../src/rules/environment/dungeon/dungeonConfig.js';

function floodFill(tiles, stride, sx, sy) {
  const visited = new Set();
  const queue = [[sx, sy]];
  const key = (x, y) => `${x},${y}`;
  visited.add(key(sx, sy));
  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= stride || ny >= stride) continue;
      const nk = key(nx, ny);
      if (visited.has(nk)) continue;
      const t = tiles[ny * stride + nx];
      if (t === TILE_FLOOR || t === TILE_DOOR) {
        visited.add(nk);
        queue.push([nx, ny]);
      }
    }
  }
  return visited;
}

Deno.test("generateChunk is deterministic", () => {
  const a = generateChunk(42, 1, 0, 0);
  const b = generateChunk(42, 1, 0, 0);
  assert(a.seed === b.seed, 'same seed');
  for (let i = 0; i < a.tiles.length; i++) {
    assert(a.tiles[i] === b.tiles[i], `tile ${i} matches`);
  }
  assert(a.rooms.length === b.rooms.length, 'same room count');
  assert(a.doors.length === b.doors.length, 'same door count');
});

Deno.test("generateChunk has rooms with floor tiles", () => {
  const chunk = generateChunk(42, 1, 0, 0);
  assert(chunk.rooms.length >= 2, `at least 2 rooms (got ${chunk.rooms.length})`);

  // Check that room centers are floor tiles
  const ox = chunk.chunkX * CHUNK_SIZE;
  const oy = chunk.chunkY * CHUNK_SIZE;
  for (const room of chunk.rooms) {
    const lx = room.x - ox + Math.floor(room.w / 2);
    const ly = room.y - oy + Math.floor(room.h / 2);
    const t = chunk.tiles[ly * CHUNK_SIZE + lx];
    assert(t === TILE_FLOOR, `room center (${lx},${ly}) is floor (got ${t})`);
  }
});

Deno.test("generateChunk has no VOID inside rooms", () => {
  const chunk = generateChunk(123, 1, 0, 0);
  const ox = chunk.chunkX * CHUNK_SIZE;
  const oy = chunk.chunkY * CHUNK_SIZE;
  for (const room of chunk.rooms) {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        const lx = x - ox, ly = y - oy;
        if (lx < 0 || ly < 0 || lx >= CHUNK_SIZE || ly >= CHUNK_SIZE) continue;
        const t = chunk.tiles[ly * CHUNK_SIZE + lx];
        assert(t !== TILE_VOID, `no void inside room at local (${lx},${ly})`);
      }
    }
  }
});

Deno.test("doors are placed at valid pinch points", () => {
  const chunk = generateChunk(42, 1, 0, 0);
  const ox = chunk.chunkX * CHUNK_SIZE;
  const oy = chunk.chunkY * CHUNK_SIZE;

  for (const door of chunk.doors) {
    const lx = door.x - ox, ly = door.y - oy;
    assert(lx >= 1 && lx < CHUNK_SIZE - 1, 'door not on edge');
    assert(ly >= 1 && ly < CHUNK_SIZE - 1, 'door not on edge');
    // The tile should be TILE_DOOR
    assert(chunk.tiles[ly * CHUNK_SIZE + lx] === TILE_DOOR,
      `door at (${lx},${ly}) is TILE_DOOR`);

    const n = chunk.tiles[(ly - 1) * CHUNK_SIZE + lx];
    const s = chunk.tiles[(ly + 1) * CHUNK_SIZE + lx];
    const e = chunk.tiles[ly * CHUNK_SIZE + (lx + 1)];
    const w = chunk.tiles[ly * CHUNK_SIZE + (lx - 1)];
    const nsWalls = (n === TILE_WALL) && (s === TILE_WALL);
    const ewWalls = (e === TILE_WALL) && (w === TILE_WALL);
    const singlePinch = nsWalls !== ewWalls;

    const doorUp = chunk.tiles[(ly - 1) * CHUNK_SIZE + lx] === TILE_DOOR;
    const doorDown = chunk.tiles[(ly + 1) * CHUNK_SIZE + lx] === TILE_DOOR;
    const doorLeft = chunk.tiles[ly * CHUNK_SIZE + (lx - 1)] === TILE_DOOR;
    const doorRight = chunk.tiles[ly * CHUNK_SIZE + (lx + 1)] === TILE_DOOR;
    const verticalDouble = (doorUp || doorDown)
      && chunk.tiles[Math.max(0, ly - 2) * CHUNK_SIZE + lx] === TILE_WALL
      && chunk.tiles[Math.min(CHUNK_SIZE - 1, ly + 2) * CHUNK_SIZE + lx] === TILE_WALL;
    const horizontalDouble = (doorLeft || doorRight)
      && chunk.tiles[ly * CHUNK_SIZE + Math.max(0, lx - 2)] === TILE_WALL
      && chunk.tiles[ly * CHUNK_SIZE + Math.min(CHUNK_SIZE - 1, lx + 2)] === TILE_WALL;

    assert(
      singlePinch || verticalDouble || horizontalDouble,
      `door at (${lx},${ly}) must be single pinch or part of a valid double-door frame`,
    );
  }
});

Deno.test("edgeGate is symmetric", () => {
  const ab = edgeGate(42, 1, 0, 0, 1, 0);
  const ba = edgeGate(42, 1, 1, 0, 0, 0);
  assert(ab === ba, `edgeGate is symmetric: ${ab} vs ${ba}`);
});

Deno.test("edgeGate returns position in valid range", () => {
  for (const seed of [1, 42, 999]) {
    const pos = edgeGate(seed, 1, 0, 0, 1, 0);
    assert(pos >= 2 && pos <= CHUNK_SIZE - 3, `gate pos in range: ${pos}`);
  }
});

Deno.test("adjacent chunks share floor tiles at gate positions", () => {
  const worldSeed = 42;
  const depth = 1;

  // East neighbor: chunks (0,0) and (1,0)
  const chunkA = generateChunk(worldSeed, depth, 0, 0);
  const chunkB = generateChunk(worldSeed, depth, 1, 0);
  const gateY = edgeGate(worldSeed, depth, 0, 0, 1, 0);

  // Chunk A's east edge (x = CHUNK_SIZE - 1) at gateY
  const tA = chunkA.tiles[gateY * CHUNK_SIZE + (CHUNK_SIZE - 1)];
  // Chunk B's west edge (x = 0) at gateY
  const tB = chunkB.tiles[gateY * CHUNK_SIZE + 0];

  const isWalkable = t => t === TILE_FLOOR || t === TILE_DOOR;
  assert(isWalkable(tA), `chunk A east edge at gate (y=${gateY}) is walkable (got ${tA})`);
  assert(isWalkable(tB), `chunk B west edge at gate (y=${gateY}) is walkable (got ${tB})`);
});

Deno.test("adjacent chunks north/south share floor at gate", () => {
  const worldSeed = 42;
  const depth = 1;

  const chunkA = generateChunk(worldSeed, depth, 0, 0);
  const chunkB = generateChunk(worldSeed, depth, 0, 1);
  const gateX = edgeGate(worldSeed, depth, 0, 0, 0, 1);

  // Chunk A south edge (y = CHUNK_SIZE - 1) at gateX
  const tA = chunkA.tiles[(CHUNK_SIZE - 1) * CHUNK_SIZE + gateX];
  // Chunk B north edge (y = 0) at gateX
  const tB = chunkB.tiles[0 * CHUNK_SIZE + gateX];

  const isWalkable = t => t === TILE_FLOOR || t === TILE_DOOR;
  assert(isWalkable(tA), `chunk A south edge at gate (x=${gateX}) is walkable (got ${tA})`);
  assert(isWalkable(tB), `chunk B north edge at gate (x=${gateX}) is walkable (got ${tB})`);
});

Deno.test("all rooms within a chunk are connected (internal flood-fill)", () => {
  for (const seed of [1, 42, 123, 777]) {
    const chunk = generateChunk(seed, 1, 0, 0);
    if (chunk.rooms.length < 2) continue;

    const ox = chunk.chunkX * CHUNK_SIZE;
    const oy = chunk.chunkY * CHUNK_SIZE;
    const r0 = chunk.rooms[0];
    const cx0 = r0.x - ox + Math.floor(r0.w / 2);
    const cy0 = r0.y - oy + Math.floor(r0.h / 2);

    const reachable = floodFill(chunk.tiles, CHUNK_SIZE, cx0, cy0);

    for (const room of chunk.rooms) {
      const cx = room.x - ox + Math.floor(room.w / 2);
      const cy = room.y - oy + Math.floor(room.h / 2);
      assert(reachable.has(`${cx},${cy}`),
        `room center (${cx},${cy}) reachable [seed=${seed}]`);
    }
  }
});

Deno.test("rooms have world-coordinate positions", () => {
  const chunk = generateChunk(42, 1, 3, -2);
  const ox = 3 * CHUNK_SIZE;
  const oy = -2 * CHUNK_SIZE;
  for (const room of chunk.rooms) {
    assert(room.x >= ox, `room.x >= chunk origin x`);
    assert(room.y >= oy, `room.y >= chunk origin y`);
    assert(room.x + room.w <= ox + CHUNK_SIZE, `room fits in chunk x`);
    assert(room.y + room.h <= oy + CHUNK_SIZE, `room fits in chunk y`);
  }
});

Deno.test("room sparsity reduces per-chunk room count", () => {
  const previous = dungeonConfig.roomSparsity;
  const seeds = [1, 42, 123, 777, 999];

  try {
    dungeonConfig.roomSparsity = 0;
    const denseCount = seeds.reduce((sum, seed) => sum + generateChunk(seed, 1, 0, 0).rooms.length, 0);

    dungeonConfig.roomSparsity = 0.75;
    const sparseCount = seeds.reduce((sum, seed) => sum + generateChunk(seed, 1, 0, 0).rooms.length, 0);

    assert(sparseCount < denseCount, `expected sparse chunks to have fewer rooms (${sparseCount} < ${denseCount})`);
  } finally {
    dungeonConfig.roomSparsity = previous;
  }
});

Deno.test("generated chunks do not leave interior floor tiles touching void", () => {
  for (const seed of [1, 42, 123, 777]) {
    const chunk = generateChunk(seed, 1, 0, 0);
    for (let y = 1; y < CHUNK_SIZE - 1; y++) {
      for (let x = 1; x < CHUNK_SIZE - 1; x++) {
        const tile = chunk.tiles[y * CHUNK_SIZE + x];
        if (tile !== TILE_FLOOR && tile !== TILE_DOOR) continue;
        const neighbors = [
          chunk.tiles[y * CHUNK_SIZE + x - 1],
          chunk.tiles[y * CHUNK_SIZE + x + 1],
          chunk.tiles[(y - 1) * CHUNK_SIZE + x],
          chunk.tiles[(y + 1) * CHUNK_SIZE + x],
        ];
        assert(
          neighbors.every((neighbor) => neighbor !== TILE_VOID),
          `seed ${seed} leaked void next to walkable tile at (${x},${y})`
        );
      }
    }
  }
});

Deno.test("findDoorPositions places double doors across a 2-wide hallway opening", () => {
  const stride = 12;
  const tiles = new Uint8Array(stride * stride);
  tiles.fill(TILE_WALL);

  // 2-wide horizontal hall passing through a framed opening at x=6.
  const y0 = 5;
  const y1 = 6;
  for (let x = 2; x <= 9; x++) {
    tiles[y0 * stride + x] = TILE_FLOOR;
    tiles[y1 * stride + x] = TILE_FLOOR;
  }
  // Keep walls above and below the pair to create a true two-door frame.
  tiles[(y0 - 1) * stride + 6] = TILE_WALL;
  tiles[(y1 + 1) * stride + 6] = TILE_WALL;

  const doors = findDoorPositions(tiles, stride, createRng(123), 1.0);
  const keys = new Set(doors.map((d) => `${d.x},${d.y}`));
  assert(keys.has("6,5"), "expected top door tile in double-door frame");
  assert(keys.has("6,6"), "expected bottom door tile in double-door frame");
});

Deno.test("sanitizeDoorTiles removes unframed doors in open rooms", () => {
  const stride = 9;
  const tiles = new Uint8Array(stride * stride);
  tiles.fill(TILE_WALL);

  // Carve a 5x5 room interior.
  for (let y = 2; y <= 6; y++) {
    for (let x = 2; x <= 6; x++) {
      tiles[y * stride + x] = TILE_FLOOR;
    }
  }

  // Invalid door in the center of open room.
  tiles[4 * stride + 4] = TILE_DOOR;
  assert(!isDoorFrameAt(tiles, stride, 4, 4), "door center should not be a valid frame");

  sanitizeDoorTiles(tiles, stride);
  assert(tiles[4 * stride + 4] === TILE_FLOOR, "unframed center door should be downgraded to floor");
});
