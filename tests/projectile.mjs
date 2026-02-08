import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Projectile } from '../src/rules/components/Projectile.js';
import { projectileSystem } from '../src/rules/systems/projectileSystem.js';

function assert(c, m) { if (!c) throw new Error('Assertion failed: ' + m); }

async function run() {
  const world = new World({ seed: 1 });

  // Simple velocity projectile
  const arrow = world.create();
  world.add(arrow, Position, { x: 0, y: 0 });
  world.add(arrow, Projectile, { vx: 1, vy: 0, speed: 0 });

  projectileSystem(world, 1);
  let pos = world.get(arrow, Position);
  assert(pos.x === 1 && pos.y === 0, `arrow tick 1: expected (1,0), got (${pos.x},${pos.y})`);

  projectileSystem(world, 1);
  pos = world.get(arrow, Position);
  assert(pos.x === 2 && pos.y === 0, `arrow tick 2: expected (2,0), got (${pos.x},${pos.y})`);

  // Diagonal projectile
  const bolt = world.create();
  world.add(bolt, Position, { x: 5, y: 5 });
  world.add(bolt, Projectile, { vx: -1, vy: 1, speed: 0 });

  projectileSystem(world, 1);
  const bpos = world.get(bolt, Position);
  assert(bpos.x === 4 && bpos.y === 6, `bolt: expected (4,6), got (${bpos.x},${bpos.y})`);

  // Speed-normalized projectile: vx=3, vy=4, speed=10
  // magnitude = 5, so normalized = (3/5)*10=6, (4/5)*10=8
  const fast = world.create();
  world.add(fast, Position, { x: 0, y: 0 });
  world.add(fast, Projectile, { vx: 3, vy: 4, speed: 10 });

  projectileSystem(world, 1);
  const fpos = world.get(fast, Position);
  assert(fpos.x === 6 && fpos.y === 8, `speed-normalized: expected (6,8), got (${fpos.x},${fpos.y})`);

  // dt scaling: half-step
  const slow = world.create();
  world.add(slow, Position, { x: 0, y: 0 });
  world.add(slow, Projectile, { vx: 4, vy: 0, speed: 0 });

  projectileSystem(world, 0.5);
  const spos = world.get(slow, Position);
  assert(spos.x === 2 && spos.y === 0, `dt=0.5: expected (2,0), got (${spos.x},${spos.y})`);

  console.log('Projectile tests PASS');
}

run().catch(e => { console.error(e); process.exitCode = 1; });
