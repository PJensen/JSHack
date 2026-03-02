// tests/aiScurry.test.mjs
// Scurry system: dumb idle enemies wander randomly; smart/alerted ones do not.

import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position }    from '../src/rules/components/Position.js';
import { Player }      from '../src/rules/components/Player.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { Faction }     from '../src/rules/components/Faction.js';
import { MoveIntent }  from '../src/rules/components/Intents/MoveIntent.js';
import { AggroState, AGGRO_LEVELS } from '../src/rules/components/AggroState.js';
import { aiScurrySystem } from '../src/rules/systems/aiScurrySystem.js';

// Helper: create a minimal world with a player so forEachInRadius has an anchor.
function makeWorld(seed = 1) {
  const world = new World({ seed });
  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });
  return world;
}

// Helper: add an unaware enemy with explicit intelligence.
function addIdleEnemy(world, id, x, y, identity) {
  world.add(id, Position, { x, y });
  world.add(id, NamedIdentity, { name: identity, identity });
  world.add(id, Faction, { key: 'enemy' });
  world.add(id, AggroState, {
    alertLevel: AGGRO_LEVELS.unaware,
    lastKnownX: 0, lastKnownY: 0, searchTurnsLeft: 0, retreating: false,
  });
}

Deno.test("dumb unaware enemy gets a MoveIntent on a scurry turn (rand forced high)", () => {
  const world = makeWorld(1);
  // Force world.rand so:
  //   first call (0.5 check) → 0.9  (≥ 0.5 → MOVE, does not return early)
  //   second call (direction) → 0.0 → DIRS[0] = { dx:0, dy:-1 }
  let callCount = 0;
  const vals = [0.9, 0.0];
  world.rand = () => vals[callCount++ % vals.length];

  const rat = world.create();
  addIdleEnemy(world, rat, 6, 5, 'rat'); // rat: intelligence = 2

  aiScurrySystem(world);

  assert(world.has(rat, MoveIntent), 'dumb unaware enemy should get a MoveIntent');
});

Deno.test("dumb unaware enemy does NOT move on a rest turn (rand forced low)", () => {
  const world = makeWorld(2);
  world.rand = () => 0.1; // < 0.5 → rest (early return)

  const rat = world.create();
  addIdleEnemy(world, rat, 6, 5, 'rat');

  aiScurrySystem(world);

  assert(!world.has(rat, MoveIntent), 'dumb enemy should rest when rand < 0.5');
});

Deno.test("smart enemy (goblin, intelligence 4) is NOT scurried", () => {
  const world = makeWorld(3);
  world.rand = () => 0.0; // would force move if eligible

  const goblin = world.create();
  addIdleEnemy(world, goblin, 6, 5, 'goblin'); // goblin: intelligence = 4

  aiScurrySystem(world);

  assert(!world.has(goblin, MoveIntent), 'goblin (intelligence 4) should not scurry');
});

Deno.test("alerted enemy (intelligence 2) is NOT scurried — alert state gates it", () => {
  const world = makeWorld(4);
  world.rand = () => 0.0;

  const bat = world.create();
  world.add(bat, Position, { x: 6, y: 5 });
  world.add(bat, NamedIdentity, { name: 'Bat', identity: 'bat' });
  world.add(bat, Faction, { key: 'enemy' });
  world.add(bat, AggroState, {
    alertLevel: AGGRO_LEVELS.alerted, // not unaware!
    lastKnownX: 5, lastKnownY: 5, searchTurnsLeft: 8, retreating: false,
  });

  aiScurrySystem(world);

  assert(!world.has(bat, MoveIntent), 'alerted bat should not scurry — chase system handles it');
});

Deno.test("hunting enemy (intelligence 2) is NOT scurried", () => {
  const world = makeWorld(5);
  world.rand = () => 0.0;

  const bat = world.create();
  world.add(bat, Position, { x: 6, y: 5 });
  world.add(bat, NamedIdentity, { name: 'Bat', identity: 'bat' });
  world.add(bat, Faction, { key: 'enemy' });
  world.add(bat, AggroState, {
    alertLevel: AGGRO_LEVELS.hunting,
    lastKnownX: 5, lastKnownY: 5, searchTurnsLeft: 10, retreating: false,
  });

  aiScurrySystem(world);

  assert(!world.has(bat, MoveIntent), 'hunting bat should not scurry — chase system handles it');
});

Deno.test("pre-existing MoveIntent is never overwritten by scurry", () => {
  const world = makeWorld(6);
  world.rand = () => 0.0;

  const rat = world.create();
  addIdleEnemy(world, rat, 6, 5, 'rat');
  world.add(rat, MoveIntent, { dx: 1, dy: 0 }); // pre-existing

  aiScurrySystem(world);

  const intent = world.get(rat, MoveIntent);
  assertEquals(intent.dx, 1, 'pre-existing MoveIntent should not be overwritten by scurry');
  assertEquals(intent.dy, 0);
});

Deno.test("neutral faction entity is ignored by scurry", () => {
  const world = makeWorld(7);
  world.rand = () => 0.0;

  const npc = world.create();
  world.add(npc, Position, { x: 6, y: 5 });
  world.add(npc, NamedIdentity, { name: 'Rat', identity: 'rat' });
  world.add(npc, Faction, { key: 'neutral' }); // not enemy
  world.add(npc, AggroState, {
    alertLevel: AGGRO_LEVELS.unaware,
    lastKnownX: 0, lastKnownY: 0, searchTurnsLeft: 0, retreating: false,
  });

  aiScurrySystem(world);

  assert(!world.has(npc, MoveIntent), 'neutral faction should be ignored');
});
