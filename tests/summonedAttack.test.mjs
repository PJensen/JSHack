import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Faction } from '../src/rules/components/Faction.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { Speed } from '../src/rules/components/Speed.js';
import { MoveIntent } from '../src/rules/components/Intents/MoveIntent.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
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
