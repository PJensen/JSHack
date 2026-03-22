import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Faction } from '../src/rules/components/Faction.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { Speed } from '../src/rules/components/Speed.js';
import { MoveIntent } from '../src/rules/components/Intents/MoveIntent.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { PetState } from '../src/rules/components/PetState.js';
import { Player } from '../src/rules/components/Player.js';
import { summonedBehaviorSystem } from '../src/rules/systems/summonedBehaviorSystem.js';

// Helpers ──────────────────────────────────────────────────────────────────

function makeSummoned(world, x, y) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Faction, { key: 'summoned' });
  world.add(id, Vitality, { hp: 10, maxHp: 10 });
  world.add(id, Speed, { actEvery: 1 });
  world.add(id, NamedIdentity, { name: 'Skeleton', identity: 'skeleton' });
  return id;
}

function makeEnemy(world, x, y) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Faction, { key: 'enemy' });
  world.add(id, Vitality, { hp: 10, maxHp: 10 });
  world.add(id, NamedIdentity, { name: 'Goblin', identity: 'goblin' });
  return id;
}

// Tests ───────────────────────────────────────────────────────────────────

Deno.test("summoned creature moves toward distant enemy", () => {
  const world = new World({ seed: 1 });
  world.step = 0;

  const skel = makeSummoned(world, 5, 5);
  const enemy = makeEnemy(world, 8, 5);

  summonedBehaviorSystem(world);

  const intent = world.get(skel, MoveIntent);
  assert(intent, "summoned should have MoveIntent");
  assertEquals(intent.dx, 1, "should move east toward enemy");
  assertEquals(intent.dy, 0);
});

Deno.test("summoned creature issues MoveIntent when adjacent (for bump attack)", () => {
  const world = new World({ seed: 1 });
  world.step = 0;

  const skel = makeSummoned(world, 5, 5);
  const enemy = makeEnemy(world, 6, 5);

  summonedBehaviorSystem(world);

  const intent = world.get(skel, MoveIntent);
  assert(intent, "summoned should have MoveIntent when adjacent to enemy");
  assertEquals(intent.dx, 1, "should move into enemy tile for bump attack");
  assertEquals(intent.dy, 0);
});

Deno.test("summoned creature ignores friendly entities", () => {
  const world = new World({ seed: 1 });
  world.step = 0;

  const skel = makeSummoned(world, 5, 5);

  // Create another summoned creature (ally, not enemy)
  const ally = world.create();
  world.add(ally, Position, { x: 6, y: 5 });
  world.add(ally, Faction, { key: 'summoned' });
  world.add(ally, Vitality, { hp: 10, maxHp: 10 });

  summonedBehaviorSystem(world);

  const intent = world.get(skel, MoveIntent);
  assert(!intent, "summoned should NOT move toward ally");
});

Deno.test("summoned creature ignores dead enemies", () => {
  const world = new World({ seed: 1 });
  world.step = 0;

  const skel = makeSummoned(world, 5, 5);
  const enemy = makeEnemy(world, 6, 5);

  // Kill the enemy
  const vit = world.get(enemy, Vitality);
  vit.hp = 0;

  summonedBehaviorSystem(world);

  const intent = world.get(skel, MoveIntent);
  assert(!intent, "summoned should NOT move toward dead enemy");
});

Deno.test("summoned creature picks closest enemy", () => {
  const world = new World({ seed: 1 });
  world.step = 0;

  const skel = makeSummoned(world, 5, 5);
  const farEnemy = makeEnemy(world, 15, 5);
  const nearEnemy = makeEnemy(world, 7, 5);

  summonedBehaviorSystem(world);

  const intent = world.get(skel, MoveIntent);
  assert(intent, "summoned should have MoveIntent");
  assertEquals(intent.dx, 1, "should move toward nearer enemy");
  assertEquals(intent.dy, 0);
});

// Helpers for command tests ─────────────────────────────────────────────────

function makePlayer(world, x, y) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Player, {});
  return id;
}

function makeSummonedWithState(world, x, y, state, targetX, targetY) {
  const id = makeSummoned(world, x, y);
  world.add(id, PetState, {
    state,
    targetX: targetX ?? null,
    targetY: targetY ?? null,
    targetItemId: 0,
    stateEnteredTurn: 0,
    lastPlayerX: null,
    lastPlayerY: null,
    commandCooldown: 0,
    rangedCooldown: 0,
  });
  return id;
}

// Command behavior tests ───────────────────────────────────────────────────

Deno.test("summoned with aggressive PetState still chases enemies", () => {
  const world = new World({ seed: 1 });
  world.step = 0;
  makePlayer(world, 0, 0);

  const skel = makeSummonedWithState(world, 5, 5, 'aggressive');
  makeEnemy(world, 8, 5);

  summonedBehaviorSystem(world);

  const intent = world.get(skel, MoveIntent);
  assert(intent, "aggressive summoned should chase enemy");
  assertEquals(intent.dx, 1);
  assertEquals(intent.dy, 0);
});

Deno.test("summoned with following PetState moves toward player", () => {
  const world = new World({ seed: 1 });
  world.step = 0;
  makePlayer(world, 0, 0);

  const skel = makeSummonedWithState(world, 5, 5, 'following');
  // Enemy is nearby but summoned should follow player instead
  makeEnemy(world, 7, 5);

  summonedBehaviorSystem(world);

  const intent = world.get(skel, MoveIntent);
  assert(intent, "following summoned should move toward player");
  assertEquals(intent.dx, -1, "should move west toward player");
  assertEquals(intent.dy, 0);
});

Deno.test("summoned with following PetState stays put when close to player", () => {
  const world = new World({ seed: 1 });
  world.step = 0;
  makePlayer(world, 4, 5);

  // Within FOLLOW_DISTANCE (2)
  const skel = makeSummonedWithState(world, 5, 5, 'following');

  summonedBehaviorSystem(world);

  const intent = world.get(skel, MoveIntent);
  assert(!intent, "following summoned should not move when close to player");
});

Deno.test("summoned with staying PetState holds position", () => {
  const world = new World({ seed: 1 });
  world.step = 0;
  makePlayer(world, 0, 0);

  const skel = makeSummonedWithState(world, 5, 5, 'staying', 5, 5);
  makeEnemy(world, 6, 5);

  summonedBehaviorSystem(world);

  const intent = world.get(skel, MoveIntent);
  assert(!intent, "staying summoned should hold position");
});

Deno.test("summoned with idle PetState does nothing", () => {
  const world = new World({ seed: 1 });
  world.step = 0;
  makePlayer(world, 0, 0);

  const skel = makeSummonedWithState(world, 5, 5, 'idle');
  makeEnemy(world, 6, 5);

  summonedBehaviorSystem(world);

  const intent = world.get(skel, MoveIntent);
  assert(!intent, "idle summoned should do nothing");
});

Deno.test("summoned with guarding PetState attacks enemies within radius", () => {
  const world = new World({ seed: 1 });
  world.step = 0;
  makePlayer(world, 0, 0);

  const skel = makeSummonedWithState(world, 5, 5, 'guarding', 5, 5);
  makeEnemy(world, 7, 5); // distance 2, within GUARD_RADIUS (5)

  summonedBehaviorSystem(world);

  const intent = world.get(skel, MoveIntent);
  assert(intent, "guarding summoned should move toward nearby enemy");
  assertEquals(intent.dx, 1, "should move east toward enemy");
  assertEquals(intent.dy, 0);
});

Deno.test("summoned with guarding PetState ignores distant enemies", () => {
  const world = new World({ seed: 1 });
  world.step = 0;
  makePlayer(world, 0, 0);

  const skel = makeSummonedWithState(world, 5, 5, 'guarding', 5, 5);
  makeEnemy(world, 15, 5); // distance 10, outside GUARD_RADIUS (5)

  summonedBehaviorSystem(world);

  const intent = world.get(skel, MoveIntent);
  assert(!intent, "guarding summoned should ignore enemies outside guard radius");
});

Deno.test("summoned auto-transitions to fleeing on low HP", () => {
  const world = new World({ seed: 1 });
  world.step = 0;
  makePlayer(world, 0, 0);

  const skel = makeSummonedWithState(world, 5, 5, 'aggressive');
  // Set HP below FLEE_THRESHOLD (50%)
  const vit = world.get(skel, Vitality);
  vit.hp = 4; // 40% of 10

  summonedBehaviorSystem(world);

  const petState = world.get(skel, PetState);
  assertEquals(petState.state, 'fleeing', "should auto-transition to fleeing");
});

Deno.test("summoned without PetState falls back to original chase", () => {
  const world = new World({ seed: 1 });
  world.step = 0;
  makePlayer(world, 0, 0);

  // No PetState — backward compat
  const skel = makeSummoned(world, 5, 5);
  makeEnemy(world, 8, 5);

  summonedBehaviorSystem(world);

  const intent = world.get(skel, MoveIntent);
  assert(intent, "summoned without PetState should still chase enemies");
  assertEquals(intent.dx, 1);
  assertEquals(intent.dy, 0);
});
