import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { ActiveEffects } from '../src/rules/components/ActiveEffects.js';
import { runScript, ScriptVerb } from '../src/rules/scripting.js';
import '../src/rules/data/affixes.js'; // side-effect: registers flaming script

function makeCtx(world, attacker, defender, damage) {
  const base = { attacker, defender, weaponId: 0, damage, world };
  base.addBonus = (k, v) => { if (k === 'damage') base.damage += v; };
  base.retaliate = () => {};
  base.heal = () => {};
  base.healAttacker = () => {};
  return base;
}

Deno.test("flaming affix applies burning to defender at ~50% rate", () => {
  const world = new World({ seed: 0xC0FFEE });

  const attacker = world.create();
  world.add(attacker, Vitality, { maxHp: 20, hp: 20 });

  const defender = world.create();
  world.add(defender, Vitality, { maxHp: 20, hp: 20 });
  world.add(defender, ActiveEffects, { effects: [] });

  let burns = 0;
  const TRIALS = 40;
  for (let i = 0; i < TRIALS; i++) {
    // Clear effects each trial
    world.get(defender, ActiveEffects).effects.length = 0;
    // Advance world step so the RNG seed changes each iteration
    world.step = i;
    const ctx = makeCtx(world, attacker, defender, 5);
    runScript('affix:flaming', ScriptVerb.AffixOnHit, world, ctx);
    const ae = world.get(defender, ActiveEffects);
    if (ae && ae.effects.some(e => e.key === 'burning')) burns++;
  }

  // At 50% proc, expect roughly 10-30 burns in 40 trials (generous range for seeded RNG).
  assert(burns >= 5, `expected at least 5 burns in ${TRIALS} trials, got ${burns}`);
  assert(burns <= 35, `expected at most 35 burns in ${TRIALS} trials, got ${burns}`);
});

Deno.test("flaming affix does not throw when defender has no ActiveEffects", () => {
  const world = new World({ seed: 0xDEAD });

  const attacker = world.create();
  const defender = world.create();
  world.add(defender, Vitality, { maxHp: 20, hp: 20 });
  // No ActiveEffects component — upsertEffect uses try/catch and world.add fallback.

  for (let i = 0; i < 5; i++) {
    world.step = i;
    runScript('affix:flaming', ScriptVerb.AffixOnHit, world, makeCtx(world, attacker, defender, 5));
  }
});
