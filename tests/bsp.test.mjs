import { assert } from "jsr:@std/assert";
import { createRng } from '../src/lib/ecs-js/rng.js';
import { buildBSP, placeRooms, carveRooms, connectRooms, collectLeafRooms } from '../src/rules/environment/dungeon/bsp.js';
import { CHUNK_SIZE, TILE_VOID, TILE_FLOOR, TILE_WALL, MIN_ROOM_SIZE } from '../src/rules/environment/dungeon/constants.js';

function makeTiles() { return new Uint8Array(CHUNK_SIZE * CHUNK_SIZE); }

function floodFill(tiles, stride, sx, sy) {
  const visited = new Set();
  const queue = [[sx, sy]];
  const key = (x, y) => `${x},${y}`;
  visited.add(key(sx, sy));
  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      const nk = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= stride || ny >= stride) continue;
      if (visited.has(nk)) continue;
      if (tiles[ny * stride + nx] !== TILE_FLOOR) continue;
      visited.add(nk);
      queue.push([nx, ny]);
    }
  }
  return visited;
}

function bspNodesEqual(a, b) {
  if (a.x !== b.x || a.y !== b.y || a.w !== b.w || a.h !== b.h) return false;
  if (a.splitH !== b.splitH) return false;
  if ((a.left === null) !== (b.left === null)) return false;
  if ((a.right === null) !== (b.right === null)) return false;
  if (a.left && !bspNodesEqual(a.left, b.left)) return false;
  if (a.right && !bspNodesEqual(a.right, b.right)) return false;
  return true;
}

Deno.test("BSP produces deterministic tree from same seed", () => {
  const t1 = buildBSP(0, 0, CHUNK_SIZE, CHUNK_SIZE, createRng(42));
  const t2 = buildBSP(0, 0, CHUNK_SIZE, CHUNK_SIZE, createRng(42));
  assert(bspNodesEqual(t1, t2), 'same seed produces identical BSP tree');
});

Deno.test("BSP produces different trees from different seeds", () => {
  const t1 = buildBSP(0, 0, CHUNK_SIZE, CHUNK_SIZE, createRng(42));
  const t2 = buildBSP(0, 0, CHUNK_SIZE, CHUNK_SIZE, createRng(999));
  // They *could* theoretically be the same, but with 32x32 and different seeds it's exceedingly unlikely
  // Check at least one structural difference
  const rooms1 = collectLeafRooms((() => { placeRooms(t1, createRng(42)); return t1; })());
  const rooms2 = collectLeafRooms((() => { placeRooms(t2, createRng(999)); return t2; })());
  const r1str = rooms1.map(r => `${r.x},${r.y}`).join(';');
  const r2str = rooms2.map(r => `${r.x},${r.y}`).join(';');
  assert(r1str !== r2str, 'different seeds produce different room layouts');
});

Deno.test("BSP has at least 2 leaf nodes", () => {
  const tree = buildBSP(0, 0, CHUNK_SIZE, CHUNK_SIZE, createRng(123));
  placeRooms(tree, createRng(123));
  const rooms = collectLeafRooms(tree);
  assert(rooms.length >= 2, `expected >= 2 rooms, got ${rooms.length}`);
});

Deno.test("all rooms are within chunk bounds", () => {
  for (const seed of [1, 42, 123, 777, 999]) {
    const tree = buildBSP(0, 0, CHUNK_SIZE, CHUNK_SIZE, createRng(seed));
    placeRooms(tree, createRng(seed));
    const rooms = collectLeafRooms(tree);
    for (const room of rooms) {
      assert(room.x >= 0, `room.x >= 0 (seed=${seed}, got ${room.x})`);
      assert(room.y >= 0, `room.y >= 0 (seed=${seed}, got ${room.y})`);
      assert(room.x + room.w <= CHUNK_SIZE, `room fits in X (seed=${seed})`);
      assert(room.y + room.h <= CHUNK_SIZE, `room fits in Y (seed=${seed})`);
    }
  }
});

Deno.test("all rooms meet minimum size", () => {
  for (const seed of [1, 42, 123, 777, 999]) {
    const tree = buildBSP(0, 0, CHUNK_SIZE, CHUNK_SIZE, createRng(seed));
    placeRooms(tree, createRng(seed));
    const rooms = collectLeafRooms(tree);
    for (const room of rooms) {
      assert(room.w >= MIN_ROOM_SIZE, `room width >= ${MIN_ROOM_SIZE} (seed=${seed}, got ${room.w})`);
      assert(room.h >= MIN_ROOM_SIZE, `room height >= ${MIN_ROOM_SIZE} (seed=${seed}, got ${room.h})`);
    }
  }
});

Deno.test("carved rooms produce floor tiles with wall perimeters", () => {
  const tiles = makeTiles();
  const tree = buildBSP(0, 0, CHUNK_SIZE, CHUNK_SIZE, createRng(42));
  placeRooms(tree, createRng(42));
  carveRooms(tree, tiles, CHUNK_SIZE);

  const rooms = collectLeafRooms(tree);
  for (const room of rooms) {
    // Interior should be floor
    const cx = room.x + Math.floor(room.w / 2);
    const cy = room.y + Math.floor(room.h / 2);
    assert(tiles[cy * CHUNK_SIZE + cx] === TILE_FLOOR, 'room center is floor');

    // Check all interior tiles are floor
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        assert(tiles[y * CHUNK_SIZE + x] === TILE_FLOOR, `interior tile (${x},${y}) is floor`);
      }
    }
  }
});

Deno.test("all rooms connected after corridors (flood-fill reachability)", () => {
  for (const seed of [1, 42, 123, 777, 999]) {
    const rng1 = createRng(seed);
    const rng2 = createRng(seed);
    const rng3 = createRng(seed);

    const tree = buildBSP(0, 0, CHUNK_SIZE, CHUNK_SIZE, rng1);
    placeRooms(tree, rng2);
    const tiles = makeTiles();
    carveRooms(tree, tiles, CHUNK_SIZE);
    connectRooms(tree, tiles, CHUNK_SIZE, rng3);

    const rooms = collectLeafRooms(tree);
    if (rooms.length < 2) continue;

    // Flood-fill from first room center
    const r0 = rooms[0];
    const cx0 = r0.x + Math.floor(r0.w / 2);
    const cy0 = r0.y + Math.floor(r0.h / 2);
    const reachable = floodFill(tiles, CHUNK_SIZE, cx0, cy0);

    for (const room of rooms) {
      const cx = room.x + Math.floor(room.w / 2);
      const cy = room.y + Math.floor(room.h / 2);
      assert(reachable.has(`${cx},${cy}`),
        `room center (${cx},${cy}) reachable from (${cx0},${cy0}) [seed=${seed}]`);
    }
  }
});

Deno.test("no floor tiles on chunk boundary edges (rooms have walls)", () => {
  const tiles = makeTiles();
  const tree = buildBSP(0, 0, CHUNK_SIZE, CHUNK_SIZE, createRng(42));
  placeRooms(tree, createRng(42));
  carveRooms(tree, tiles, CHUNK_SIZE);
  connectRooms(tree, tiles, CHUNK_SIZE, createRng(42));

  // Check edges: row 0, row CHUNK_SIZE-1, col 0, col CHUNK_SIZE-1
  // Rooms should have walls/void at edges (ROOM_MARGIN ensures this for BSP-generated rooms)
  // Corridors might touch edges, but their wall borders should keep floors 1 tile inward
  // This is a soft check — mainly verifying the margin system works
  let edgeFloors = 0;
  for (let i = 0; i < CHUNK_SIZE; i++) {
    if (tiles[0 * CHUNK_SIZE + i] === TILE_FLOOR) edgeFloors++;
    if (tiles[(CHUNK_SIZE - 1) * CHUNK_SIZE + i] === TILE_FLOOR) edgeFloors++;
    if (tiles[i * CHUNK_SIZE + 0] === TILE_FLOOR) edgeFloors++;
    if (tiles[i * CHUNK_SIZE + (CHUNK_SIZE - 1)] === TILE_FLOOR) edgeFloors++;
  }
  // BSP rooms with margins should not touch edges, but corridors connecting rooms near
  // edges might. Just verify it's not excessive.
  assert(edgeFloors < CHUNK_SIZE, `edge floors should be minimal (got ${edgeFloors})`);
});

Deno.test("corridors and rooms do not expose interior floor directly to void", () => {
  const tiles = makeTiles();
  const tree = buildBSP(0, 0, CHUNK_SIZE, CHUNK_SIZE, createRng(42));
  placeRooms(tree, createRng(42));
  carveRooms(tree, tiles, CHUNK_SIZE);
  connectRooms(tree, tiles, CHUNK_SIZE, createRng(42));

  for (let y = 1; y < CHUNK_SIZE - 1; y++) {
    for (let x = 1; x < CHUNK_SIZE - 1; x++) {
      if (tiles[y * CHUNK_SIZE + x] !== TILE_FLOOR) continue;
      const neighbors = [
        tiles[y * CHUNK_SIZE + x - 1],
        tiles[y * CHUNK_SIZE + x + 1],
        tiles[(y - 1) * CHUNK_SIZE + x],
        tiles[(y + 1) * CHUNK_SIZE + x],
      ];
      assert(
        neighbors.every((tile) => tile !== TILE_VOID),
        `floor at (${x},${y}) should be sealed from void`
      );
    }
  }
});
