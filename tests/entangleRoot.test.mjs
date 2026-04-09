import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { Faction } from '../src/rules/components/Faction.js';
import { MoveIntent } from '../src/rules/components/Intents/MoveIntent.js';
import { ActiveEffects } from '../src/rules/components/ActiveEffects.js';
import { intentValidationSystem } from '../src/rules/systems/intentValidationSystem.js';
import { effectSystem } from '../src/rules/systems/effectSystem.js';
import { upsertTimedEffect } from '../src/rules/utils/effectSemantics.js';
import { statusStrength } from '../src/rules/utils/statusFacade.js';

Deno.test("entangle lifecycle: stun expires, rooted persists, movement blocked", () => {
  const world = new World({ seed: 1 });

  const mob = world.create();
  world.add(mob, Position, { x: 5, y: 5 });
  world.add(mob, Vitality, { hp: 10, maxHp: 10, baseMaxHp: 10 });
  world.add(mob, Faction, { key: 'enemy' });
  world.add(mob, ActiveEffects, { effects: [] });

  const ae = world.get(mob, ActiveEffects);
  const STUN_TURNS = 3;
  const ROOT_TURNS = 15;
  upsertTimedEffect(ae.effects, {
    key: 'stun', turnsLeft: STUN_TURNS + 1, potency: 1, stacks: 1,
  });
  upsertTimedEffect(ae.effects, {
    key: 'rooted', turnsLeft: STUN_TURNS + ROOT_TURNS + 1, potency: 1, stacks: 1,
  });

  // Tick until stun expires
  let tick = 0;
  while (statusStrength(world, mob, "stunned") > 0) {
    tick++;
    world.step = tick;
    effectSystem(world);
    if (tick > 20) throw new Error("stun never expired");
  }

  console.log(`stun expired after ${tick} ticks`);
  console.log(`effects remaining: ${JSON.stringify(ae.effects.map(e => ({ key: e.key, tl: e.turnsLeft })))}`);
  console.log(`rooted strength: ${statusStrength(world, mob, "rooted")}`);

  // Rooted must still be active
  const rootStr = statusStrength(world, mob, "rooted");
  assert(rootStr > 0, `rooted must be active after stun expires, got ${rootStr}`);

  // MoveIntent must be blocked
  world.add(mob, MoveIntent, { dx: 1, dy: 0 });
  intentValidationSystem(world);
  assertEquals(world.has(mob, MoveIntent), false, "MoveIntent must be stripped while rooted");
});
