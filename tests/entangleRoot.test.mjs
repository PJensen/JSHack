import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { Faction } from '../src/rules/components/Faction.js';
import { MoveIntent } from '../src/rules/components/Intents/MoveIntent.js';
import { AttackIntent } from '../src/rules/components/Intents/AttackIntent.js';
import { ActiveEffects } from '../src/rules/components/ActiveEffects.js';
import { intentValidationSystem } from '../src/rules/systems/intentValidationSystem.js';
import { upsertTimedEffect } from '../src/rules/utils/effectSemantics.js';
import { statusStrength } from '../src/rules/utils/statusFacade.js';

Deno.test("rooted status blocks MoveIntent via intentValidationSystem", () => {
  const world = new World({ seed: 1 });

  const mob = world.create();
  world.add(mob, Position, { x: 5, y: 5 });
  world.add(mob, Vitality, { hp: 10, maxHp: 10, baseMaxHp: 10 });
  world.add(mob, Faction, { key: 'enemy' });
  world.add(mob, MoveIntent, { dx: 1, dy: 0 });
  world.add(mob, ActiveEffects, { effects: [] });

  const ae = world.get(mob, ActiveEffects);
  upsertTimedEffect(ae.effects, { key: 'rooted', turnsLeft: 10, potency: 1, stacks: 1 });

  const strength = statusStrength(world, mob, "rooted");
  assertEquals(strength, 1, "rooted status strength should be 1");

  intentValidationSystem(world);

  assertEquals(world.has(mob, MoveIntent), false, "MoveIntent must be stripped when rooted");
});

Deno.test("rooted status allows AttackIntent", () => {
  const world = new World({ seed: 1 });

  const mob = world.create();
  world.add(mob, Position, { x: 5, y: 5 });
  world.add(mob, Vitality, { hp: 10, maxHp: 10, baseMaxHp: 10 });
  world.add(mob, Faction, { key: 'enemy' });
  world.add(mob, AttackIntent, { targetId: 999 });
  world.add(mob, ActiveEffects, { effects: [] });

  const ae = world.get(mob, ActiveEffects);
  upsertTimedEffect(ae.effects, { key: 'rooted', turnsLeft: 10, potency: 1, stacks: 1 });

  intentValidationSystem(world);

  assertEquals(world.has(mob, AttackIntent), true, "AttackIntent must NOT be stripped when rooted");
});
