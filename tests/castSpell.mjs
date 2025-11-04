// @ts-nocheck
import { World } from '../src/lib/ecs-js/index.js';
import { createPlayer } from '../src/rules/archetypes/Player.js';
import { Brain } from '../src/rules/components/Brain.js';
import { Mana } from '../src/rules/components/Mana.js';
import { CastSpellIntent } from '../src/rules/components/Intents/CastSpellIntent.js';
import { castSpellSystem } from '../src/rules/systems/castSpellSystem.js';

function scheduler(world) {
  try { castSpellSystem(world); } catch (e) { console.error('cast system error', e); }
}

function assert(cond, msg) { if (!cond) throw new Error('Assertion failed: ' + msg); }

async function run() {
  const world = new World({ seed: 2 });
  world.setScheduler((w)=>scheduler(w));

  const player = createPlayer(world, { name: 'Mage' });
  const brain = world.get(player, Brain);
  if (!Array.isArray(brain.learnedSpellIds)) brain.learnedSpellIds = [];
  brain.learnedSpellIds.push('lightning');
  let mana = world.get(player, Mana);
  if (!mana) { world.add(player, Mana, { maxMana: 10, mana: 10, manaRegen: 0 }); mana = world.get(player, Mana); }
  mana.mana = 10;

  const events = [];
  world.on('castSpell', (e)=>events.push(['cast', e.spellId]));
  world.on('spell:oom', (e)=>events.push(['oom', e.need]));

  world.add(player, CastSpellIntent, { spellId: 'lightning' });
  world.tick(1);

  const mana2 = world.get(player, Mana);
  assert(mana2.mana === 3, 'mana reduced by 7 for lightning');
  assert(events.some(e=>e[0]==='cast' && e[1]==='lightning'), 'cast event raised');

  // Try again with insufficient mana
  world.add(player, CastSpellIntent, { spellId: 'lightning' });
  world.tick(1);
  assert(events.some(e=>e[0]==='oom'), 'oom event raised');

  console.log('castSpell PASS');
}

run().catch(e=>{ console.error(e); process.exitCode = 1; });
