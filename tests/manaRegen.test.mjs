import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Mana } from '../src/rules/components/Mana.js';
import { manaRegenerationSystem } from '../src/rules/systems/manaRegenerationSystem.js';

Deno.test("mana regenerates each tick up to max", () => {
  const world = new World({ seed: 1 });

  const mage = world.create();
  world.add(mage, Mana, { maxMana: 20, mana: 5, manaRegen: 3 });

  manaRegenerationSystem(world);
  let m = world.get(mage, Mana);
  assert(m.mana === 8, `tick 1: expected 8 mana, got ${m.mana}`);

  manaRegenerationSystem(world);
  m = world.get(mage, Mana);
  assert(m.mana === 11, `tick 2: expected 11 mana, got ${m.mana}`);

  for (let i = 0; i < 10; i++) manaRegenerationSystem(world);
  m = world.get(mage, Mana);
  assert(m.mana === 20, `capped: expected 20 mana, got ${m.mana}`);

  manaRegenerationSystem(world);
  m = world.get(mage, Mana);
  assert(m.mana === 20, `full: expected 20 mana, got ${m.mana}`);
});

Deno.test("zero regen rate does not change mana", () => {
  const world = new World({ seed: 1 });

  const warrior = world.create();
  world.add(warrior, Mana, { maxMana: 10, mana: 3, manaRegen: 0 });
  manaRegenerationSystem(world);
  const wm = world.get(warrior, Mana);
  assert(wm.mana === 3, `zero regen: expected 3, got ${wm.mana}`);
});
