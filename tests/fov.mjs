import { computeFOV } from '../src/shared/math/fov.js';

function assert(c, m) { if (!c) throw new Error('Assertion failed: ' + m); }

async function run() {
  const neverBlocked = () => false;

  // 1. Origin tile is always visible
  const vis1 = computeFOV(5, 5, 10, neverBlocked);
  assert(vis1.has('5,5'), 'origin always visible');

  // 2. Open room: all tiles within radius visible
  const vis2 = computeFOV(0, 0, 3, neverBlocked);
  assert(vis2.has('0,0'), 'center visible');
  assert(vis2.has('1,0'), 'east visible');
  assert(vis2.has('0,1'), 'south visible');
  assert(vis2.has('-1,0'), 'west visible');
  assert(vis2.has('0,-1'), 'north visible');
  assert(vis2.has('1,1'), 'diagonal visible');
  // Radius 3 should include tiles at distance 3
  assert(vis2.has('3,0'), 'distance 3 east visible');
  assert(vis2.has('0,3'), 'distance 3 south visible');

  // 3. Wall blocks tiles behind it
  // Wall at (2, 0): should block (3,0) and beyond
  const wallAt2 = (x, y) => (x === 2 && y === 0);
  const vis3 = computeFOV(0, 0, 5, wallAt2);
  assert(vis3.has('0,0'), 'origin visible with wall');
  assert(vis3.has('1,0'), 'pre-wall visible');
  assert(vis3.has('2,0'), 'wall tile itself visible');
  assert(!vis3.has('5,0'), 'far behind wall not visible');

  // 4. Radius limits visibility
  const vis4 = computeFOV(0, 0, 2, neverBlocked);
  assert(vis4.has('2,0'), 'at radius limit');
  assert(!vis4.has('3,0'), 'beyond radius not visible');

  // 5. Reuse output set
  const out = new Set();
  computeFOV(0, 0, 1, neverBlocked, out);
  assert(out.has('0,0'), 'reused set has origin');
  assert(out.size > 0, 'reused set populated');

  console.log('FOV tests PASS');
}
run().catch(e => { console.error(e); process.exitCode = 1; });
