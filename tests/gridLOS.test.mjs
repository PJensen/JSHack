import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { hasLOS } from '../src/shared/math/gridLOS.js';
import { buildBlocksVisionMap, blockedCallback } from '../src/rules/utils/vision.js';
import { loadChunk, clearAll } from '../src/rules/environment/dungeon/tileMap.js';
import { CHUNK_SIZE, TILE_FLOOR, TILE_WALL } from '../src/rules/environment/dungeon/constants.js';

Deno.test("clear LOS on empty grid", () => {
  const neverBlocked = () => false;
  assert(hasLOS(0, 0, 5, 5, neverBlocked), 'clear LOS diagonal');
  assert(hasLOS(0, 0, 10, 0, neverBlocked), 'clear LOS horizontal');
  assert(hasLOS(0, 0, 0, 10, neverBlocked), 'clear LOS vertical');
});

Deno.test("same tile always has LOS", () => {
  assert(hasLOS(3, 3, 3, 3, () => false), 'same tile LOS');
});

Deno.test("adjacent tile always has LOS even if blocked", () => {
  const alwaysBlocked = () => true;
  assert(hasLOS(0, 0, 1, 0, alwaysBlocked), 'adjacent horizontal LOS');
  assert(hasLOS(0, 0, 0, 1, alwaysBlocked), 'adjacent vertical LOS');
  assert(hasLOS(0, 0, 1, 1, alwaysBlocked), 'adjacent diagonal LOS');
});

Deno.test("wall blocks LOS at intermediate tile", () => {
  const wallAt3 = (x, y) => (x === 3 && y === 0);
  assert(!hasLOS(0, 0, 5, 0, wallAt3), 'wall blocks horizontal LOS');

  const wallAtDiag = (x, y) => (x === 2 && y === 2);
  assert(!hasLOS(0, 0, 4, 4, wallAtDiag), 'wall blocks diagonal LOS');
});

Deno.test("target tile itself does not block LOS", () => {
  const wallAtTarget = (x, y) => (x === 5 && y === 0);
  assert(hasLOS(0, 0, 5, 0, wallAtTarget), 'can see wall tile itself');
});

Deno.test("buildBlocksVisionMap with ECS world + TileMap", () => {
  clearAll();
  // Set up tileMap: floors at y=0,1 and walls at y=2
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  for (let x = 0; x <= 2; x++) {
    tiles[2 * CHUNK_SIZE + x] = TILE_WALL; // wall at y=2
  }
  loadChunk(0, 0, tiles);

  const world = new World({ seed: 42 });

  // buildBlocksVisionMap only returns entity-based blocks (Collider.blocksSight)
  // Walls are handled by tileMap.isOpaque() via blockedCallback
  const blocked = buildBlocksVisionMap(world);
  const isBlocked = blockedCallback(blocked);

  assert(!isBlocked(0, 0), 'floor 0,0 not blocked');
  assert(!isBlocked(1, 1), 'floor 1,1 not blocked');

  assert(isBlocked(0, 2), 'wall 0,2 blocked');
  assert(isBlocked(1, 2), 'wall 1,2 blocked');
  assert(isBlocked(2, 2), 'wall 2,2 blocked');

  assert(hasLOS(0, 0, 2, 1, isBlocked), 'LOS within room');
  assert(!hasLOS(0, 0, 1, 4, isBlocked), 'LOS blocked by wall row');
});
