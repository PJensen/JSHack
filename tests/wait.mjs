import { World } from '../src/lib/ecs-js/index.js';
import { WaitIntent } from '../src/rules/components/Intents/WaitIntent.js';
import { waitSystem } from '../src/rules/systems/waitSystem.js';

function assert(c, m) { if (!c) throw new Error('Assertion failed: ' + m); }

async function run() {
  const world = new World({ seed: 1 });

  const actor = world.create();
  world.add(actor, WaitIntent);

  assert(world.has(actor, WaitIntent), 'should have WaitIntent before system runs');

  waitSystem(world);

  assert(!world.has(actor, WaitIntent), 'WaitIntent should be consumed');

  // Multiple actors waiting
  const a1 = world.create();
  const a2 = world.create();
  world.add(a1, WaitIntent);
  world.add(a2, WaitIntent);

  waitSystem(world);

  assert(!world.has(a1, WaitIntent), 'a1 WaitIntent consumed');
  assert(!world.has(a2, WaitIntent), 'a2 WaitIntent consumed');

  // No waiters — should be a no-op
  waitSystem(world);

  console.log('Wait system tests PASS');
}

run().catch(e => { console.error(e); process.exitCode = 1; });
