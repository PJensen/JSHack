import { World } from '../src/lib/ecs-js/index.js';
import { Mana } from '../src/rules/components/Mana.js';
import { manaRegenerationSystem } from '../src/rules/systems/manaRegenerationSystem.js';

function assert(c, m) { if (!c) throw new Error('Assertion failed: ' + m); }

async function run() {
  const world = new World({ seed: 1 });

  const mage = world.create();
  world.add(mage, Mana, { maxMana: 20, mana: 5, manaRegen: 3 });

  // Tick 1: 5 + 3 = 8
  manaRegenerationSystem(world);
  let m = world.get(mage, Mana);
  assert(m.mana === 8, `tick 1: expected 8 mana, got ${m.mana}`);

  // Tick 2: 8 + 3 = 11
  manaRegenerationSystem(world);
  m = world.get(mage, Mana);
  assert(m.mana === 11, `tick 2: expected 11 mana, got ${m.mana}`);

  // Tick until cap
  for (let i = 0; i < 10; i++) manaRegenerationSystem(world);
  m = world.get(mage, Mana);
  assert(m.mana === 20, `capped: expected 20 mana, got ${m.mana}`);

  // Already full — should stay at max
  manaRegenerationSystem(world);
  m = world.get(mage, Mana);
  assert(m.mana === 20, `full: expected 20 mana, got ${m.mana}`);

  // Zero regen rate should not change mana
  const warrior = world.create();
  world.add(warrior, Mana, { maxMana: 10, mana: 3, manaRegen: 0 });
  manaRegenerationSystem(world);
  const wm = world.get(warrior, Mana);
  assert(wm.mana === 3, `zero regen: expected 3, got ${wm.mana}`);

  console.log('Mana regen tests PASS');
}

run().catch(e => { console.error(e); process.exitCode = 1; });
