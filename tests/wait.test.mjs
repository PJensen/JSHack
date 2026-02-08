import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { WaitIntent } from '../src/rules/components/Intents/WaitIntent.js';
import { waitSystem } from '../src/rules/systems/waitSystem.js';

Deno.test("wait system consumes WaitIntent", () => {
  const world = new World({ seed: 1 });

  const actor = world.create();
  world.add(actor, WaitIntent);

  assert(world.has(actor, WaitIntent), 'should have WaitIntent before system runs');

  waitSystem(world);

  assert(!world.has(actor, WaitIntent), 'WaitIntent should be consumed');
});

Deno.test("wait system handles multiple actors", () => {
  const world = new World({ seed: 1 });

  const a1 = world.create();
  const a2 = world.create();
  world.add(a1, WaitIntent);
  world.add(a2, WaitIntent);

  waitSystem(world);

  assert(!world.has(a1, WaitIntent), 'a1 WaitIntent consumed');
  assert(!world.has(a2, WaitIntent), 'a2 WaitIntent consumed');
});

Deno.test("wait system is no-op with no waiters", () => {
  const world = new World({ seed: 1 });
  waitSystem(world); // should not throw
});
