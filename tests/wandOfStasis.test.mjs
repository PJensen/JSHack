import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Player } from '../src/rules/components/Player.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { Faction } from '../src/rules/components/Faction.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { MoveIntent } from '../src/rules/components/Intents/MoveIntent.js';
import { ActiveEffects } from '../src/rules/components/ActiveEffects.js';
import { intentValidationSystem } from '../src/rules/systems/intentValidationSystem.js';
import { statusStrength } from '../src/rules/utils/statusFacade.js';
import { dealDamage } from '../src/rules/utils/dealDamage.js';

function makeWorld(seed = 1) {
  return new World({ seed });
}

function makePlayer(world, x, y) {
  const id = world.create();
  world.add(id, Player);
  world.add(id, Position, { x, y });
  world.add(id, NamedIdentity, { name: 'Hero', identity: 'player' });
  world.add(id, Vitality, { hp: 30, maxHp: 30 });
  return id;
}

function makeEnemyWithStasis(world, x, y, turnsLeft = 8) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, NamedIdentity, { name: 'Goblin', identity: 'goblin' });
  world.add(id, Faction, { key: 'enemy' });
  world.add(id, Vitality, { hp: 10, maxHp: 10 });
  world.add(id, ActiveEffects, {
    effects: [{ key: 'stasis', turnsLeft, stacks: 1, potency: 1 }],
  });
  return id;
}

// ── Stasis intent blocking ──────────────────────────────────────────────────

Deno.test("stasis blocks MoveIntent", () => {
  const world = makeWorld();
  makePlayer(world, 5, 5);
  const enemy = makeEnemyWithStasis(world, 8, 5);

  // Give the enemy a MoveIntent
  world.add(enemy, MoveIntent, { dx: -1, dy: 0 });

  intentValidationSystem(world);

  assert(!world.has(enemy, MoveIntent),
    "MoveIntent should be stripped from entity in stasis");
});

Deno.test("stasis does not block when turnsLeft is 0", () => {
  const world = makeWorld();
  makePlayer(world, 5, 5);
  const enemy = makeEnemyWithStasis(world, 8, 5, 0);

  world.add(enemy, MoveIntent, { dx: -1, dy: 0 });

  intentValidationSystem(world);

  // turnsLeft=0 means effect expired — intent should NOT be stripped
  assert(world.has(enemy, MoveIntent),
    "MoveIntent should remain when stasis has expired");
});

// ── Stasis damage immunity ──────────────────────────────────────────────────

Deno.test("stasis blocks damage", () => {
  const world = makeWorld();
  const player = makePlayer(world, 5, 5);
  const enemy = makeEnemyWithStasis(world, 8, 5);

  const result = dealDamage(world, {
    source: player,
    target: enemy,
    rawAmount: 5,
    type: "physical",
  });

  assertEquals(result.reason, "stasis", "damage should be blocked by stasis");
  const vit = world.get(enemy, Vitality);
  assertEquals(vit.hp, 10, "enemy HP should be unchanged");
});

Deno.test("damage works normally after stasis expires", () => {
  const world = makeWorld();
  const player = makePlayer(world, 5, 5);
  const enemy = makeEnemyWithStasis(world, 8, 5, 0); // expired

  const result = dealDamage(world, {
    source: player,
    target: enemy,
    rawAmount: 5,
    type: "physical",
  });

  assert(result.reason !== "stasis", "damage should not be blocked when stasis expired");
  const vit = world.get(enemy, Vitality);
  assert(vit.hp < 10, "enemy should take damage");
});
