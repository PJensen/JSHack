import { World } from '../src/lib/ecs-js/index.js';
import { createPlayer } from '../src/rules/archetypes/Player.js';
import { ActiveEffects } from '../src/rules/components/ActiveEffects.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { Status } from '../src/rules/components/Status.js';
import { effectSystem } from '../src/rules/systems/effectSystem.js';

function scheduler(world) {
  try { effectSystem(world); } catch (e) { console.error('effect system error', e); }
}

function assert(cond, msg) { if (!cond) throw new Error('Assertion failed: ' + msg); }

async function run() {
  const world = new World({ seed: 7 });
  world.setScheduler((w)=>scheduler(w));

  // Setup: player with Vitality 10
  const player = createPlayer(world, { name: 'Hero', maxHp: 10, hp: 10 });
  let vit = world.get(player, Vitality);
  assert(vit && vit.hp === 10 && vit.maxHp === 10, 'player vitality created');

  // Apply poison effect: 3 turns, potency 2 (2 damage per tick)
  const ae = world.get(player, ActiveEffects) || world.add(player, ActiveEffects, { effects: [] });
  (world.get(player, ActiveEffects) || ae).effects.push({ key: 'poison', turnsLeft: 3, potency: 2 });

  // Tick 1
  world.tick(1);
  vit = world.get(player, Vitality);
  let st = world.get(player, Status);
  assert(vit.hp === 8, 'poison tick 1 reduces hp by 2');
  assert(st && st.statuses.some(s => s.type === 'poisoned' && s.duration >= 2), 'status poisoned present');

  // Tick 2
  world.tick(1);
  vit = world.get(player, Vitality);
  st = world.get(player, Status);
  assert(vit.hp === 6, 'poison tick 2 reduces hp by 2');
  assert(st.statuses.some(s => s.type === 'poisoned'), 'still poisoned');

  // Tick 3 (should expire)
  world.tick(1);
  vit = world.get(player, Vitality);
  st = world.get(player, Status);
  assert(vit.hp === 4, 'poison tick 3 reduces hp by 2');
  // next tick, effect should be gone and status cleared
  world.tick(1);
  st = world.get(player, Status);
  assert(!st.statuses.some(s => s.type === 'poisoned'), 'poisoned status cleared after expiry');

  // Monster/Creature generic: apply regen and burn simultaneously
  const monster = world.create();
  world.add(monster, Vitality, { maxHp: 20, hp: 10 });
  world.add(monster, ActiveEffects, { effects: [
    { key: 'regeneration', turnsLeft: 2, potency: 3 },
    { key: 'burn', turnsLeft: 2, potency: 1 }
  ]});
  world.tick(1);
  let mvit = world.get(monster, Vitality);
  assert(mvit.hp === 12, 'regen(3) - burn(1) = +2 net');
  world.tick(1);
  mvit = world.get(monster, Vitality);
  assert(mvit.hp === 14, 'second tick net +2');
  world.tick(1);
  const mst = world.get(monster, Status);
  assert(!mst.statuses.length, 'statuses cleared after both effects expired');

  console.log('Effects tests PASS');
}

run().catch(e=>{ console.error(e); process.exitCode = 1; });
