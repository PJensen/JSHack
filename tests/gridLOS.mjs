import { World } from '../src/lib/ecs-js/index.js';
import { createFrom } from '../src/lib/ecs-js/archetype.js';
import { FloorTile, WallTile } from '../src/rules/archetypes/Tiles.js';
import { hasLOS } from '../src/shared/math/gridLOS.js';
import { buildBlocksVisionMap } from '../src/rules/utils/vision.js';

function assert(c, m) { if (!c) throw new Error('Assertion failed: ' + m); }

async function run() {
  // --- hasLOS with custom isBlocked callback ---

  const neverBlocked = () => false;

  // 1. Clear LOS on empty grid
  assert(hasLOS(0, 0, 5, 5, neverBlocked), 'clear LOS diagonal');
  assert(hasLOS(0, 0, 10, 0, neverBlocked), 'clear LOS horizontal');
  assert(hasLOS(0, 0, 0, 10, neverBlocked), 'clear LOS vertical');

  // 2. Same tile always has LOS
  assert(hasLOS(3, 3, 3, 3, neverBlocked), 'same tile LOS');

  // 3. Adjacent tile always has LOS
  const alwaysBlocked = () => true;
  assert(hasLOS(0, 0, 1, 0, alwaysBlocked), 'adjacent horizontal LOS');
  assert(hasLOS(0, 0, 0, 1, alwaysBlocked), 'adjacent vertical LOS');
  assert(hasLOS(0, 0, 1, 1, alwaysBlocked), 'adjacent diagonal LOS');

  // 4. Wall blocks LOS at intermediate tile
  const wallAt3 = (x, y) => (x === 3 && y === 0);
  assert(!hasLOS(0, 0, 5, 0, wallAt3), 'wall blocks horizontal LOS');

  const wallAtDiag = (x, y) => (x === 2 && y === 2);
  assert(!hasLOS(0, 0, 4, 4, wallAtDiag), 'wall blocks diagonal LOS');

  // 5. Target tile itself doesn't block (can see the wall)
  const wallAtTarget = (x, y) => (x === 5 && y === 0);
  assert(hasLOS(0, 0, 5, 0, wallAtTarget), 'can see wall tile itself');

  // --- buildBlocksVisionMap with ECS world ---

  const world = new World({ seed: 42 });

  // Floor at y=0,1; wall row at y=2
  for (let x = 0; x <= 2; x++) {
    createFrom(world, FloorTile, { x, y: 0 });
    createFrom(world, FloorTile, { x, y: 1 });
    createFrom(world, WallTile, { x, y: 2 });
  }

  const blocked = buildBlocksVisionMap(world);

  // 6. Floor tiles not in blocked set
  assert(!blocked.has('0,0'), 'floor 0,0 not blocked');
  assert(!blocked.has('1,1'), 'floor 1,1 not blocked');

  // 7. Wall tiles are in blocked set
  assert(blocked.has('0,2'), 'wall 0,2 blocked');
  assert(blocked.has('1,2'), 'wall 1,2 blocked');
  assert(blocked.has('2,2'), 'wall 2,2 blocked');

  // 8. hasLOS with world-derived blocked set
  const isBlocked = (x, y) => blocked.has(`${x},${y}`);
  assert(hasLOS(0, 0, 2, 1, isBlocked), 'LOS within room');
  assert(!hasLOS(0, 0, 1, 4, isBlocked), 'LOS blocked by wall row');

  console.log('Grid LOS tests PASS');
}
run().catch(e => { console.error(e); process.exitCode = 1; });
