import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Faction } from '../src/rules/components/Faction.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { Player } from '../src/rules/components/Player.js';
import { Pet } from '../src/rules/components/Pet.js';
import { PetState } from '../src/rules/components/PetState.js';
import { MoveIntent } from '../src/rules/components/Intents/MoveIntent.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { petBehaviorSystem } from '../src/rules/systems/petBehaviorSystem.js';

// Helpers ──────────────────────────────────────────────────────────────────

function makePlayer(world, x, y) {
  const id = world.create();
  world.add(id, Player);
  world.add(id, Position, { x, y });
  world.add(id, NamedIdentity, { name: 'Hero', identity: 'player' });
  return id;
}

function makePet(world, x, y, state) {
  const id = world.create();
  world.add(id, Pet);
  world.add(id, Position, { x, y });
  world.add(id, Faction, { key: 'pet' });
  world.add(id, Vitality, { hp: 20, maxHp: 20 });
  world.add(id, NamedIdentity, { name: 'Cat', identity: 'cat' });
  world.add(id, PetState, {
    state,
    targetX: null,
    targetY: null,
    targetItemId: 0,
    stateEnteredTurn: 0,
    lastPlayerX: null,
    lastPlayerY: null,
    commandCooldown: 0,
    rangedCooldown: 0,
  });
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

Deno.test("aggressive pet chases nearby enemy instead of following player", () => {
  const world = new World({ seed: 1 });
  world.step = 0;

  makePlayer(world, 0, 0);
  const pet = makePet(world, 5, 5, 'aggressive');
  const enemy = makeEnemy(world, 7, 5);

  petBehaviorSystem(world);

  const intent = world.get(pet, MoveIntent);
  assert(intent, "aggressive pet should have MoveIntent");
  assertEquals(intent.dx, 1, "pet should move toward enemy, not player");
  assertEquals(intent.dy, 0);
});

Deno.test("aggressive pet follows player when no enemies nearby", () => {
  const world = new World({ seed: 1 });
  world.step = 0;

  makePlayer(world, 0, 0);
  const pet = makePet(world, 5, 5, 'aggressive');
  // No enemies

  petBehaviorSystem(world);

  const intent = world.get(pet, MoveIntent);
  assert(intent, "aggressive pet should follow player when no enemies");
  // Should move toward player at (0,0) from (5,5)
  assert(intent.dx === -1 || intent.dy === -1, "pet should move toward player");
});

Deno.test("aggressive pet issues MoveIntent when adjacent to enemy (for bump attack)", () => {
  const world = new World({ seed: 1 });
  world.step = 0;

  makePlayer(world, 0, 0);
  const pet = makePet(world, 5, 5, 'aggressive');
  const enemy = makeEnemy(world, 6, 5);

  petBehaviorSystem(world);

  const intent = world.get(pet, MoveIntent);
  assert(intent, "aggressive pet should MoveIntent into adjacent enemy for bump attack");
  assertEquals(intent.dx, 1);
  assertEquals(intent.dy, 0);
});

Deno.test("guard mode pet issues MoveIntent when adjacent to enemy (for bump attack)", () => {
  const world = new World({ seed: 1 });
  world.step = 0;

  makePlayer(world, 0, 0);
  const pet = makePet(world, 5, 5, 'guarding');
  // Update guard target position
  const petState = world.get(pet, PetState);
  petState.targetX = 5;
  petState.targetY = 5;

  const enemy = makeEnemy(world, 6, 5);

  petBehaviorSystem(world);

  const intent = world.get(pet, MoveIntent);
  assert(intent, "guarding pet should MoveIntent into adjacent enemy for bump attack");
  assertEquals(intent.dx, 1);
  assertEquals(intent.dy, 0);
});

Deno.test("PetState validates aggressive as valid state", () => {
  const world = new World({ seed: 1 });
  const id = world.create();

  // Should not throw
  world.add(id, PetState, {
    state: 'aggressive',
    targetX: null,
    targetY: null,
    targetItemId: 0,
    stateEnteredTurn: 0,
    lastPlayerX: null,
    lastPlayerY: null,
    commandCooldown: 0,
    rangedCooldown: 0,
  });

  const ps = world.get(id, PetState);
  assertEquals(ps.state, 'aggressive');
});
