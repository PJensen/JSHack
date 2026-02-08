import { World } from '../src/lib/ecs-js/index.js';
import { Interactable } from '../src/rules/components/Interactable.js';
import { InteractIntent } from '../src/rules/components/Intents/InteractIntent.js';
import { DoorState } from '../src/rules/components/DoorState.js';
import { Collider } from '../src/rules/components/Collider.js';
import { interactionSystem } from '../src/rules/systems/interactionSystem.js';

function assert(c, m) { if (!c) throw new Error('Assertion failed: ' + m); }

async function run() {
  const world = new World({ seed: 1 });

  const actor = world.create();
  // --- Toggle door: closed -> open ---
  const door = world.create();
  world.add(door, Interactable, { action: 'toggleDoor', params: null });
  world.add(door, DoorState, { open: false, locked: false });
  world.add(door, Collider, { solid: true, blocksSight: true });

  world.add(actor, InteractIntent, { targetId: door });
  interactionSystem(world);

  let ds = world.get(door, DoorState);
  let col = world.get(door, Collider);
  assert(ds.open === true, `door should be open, got ${ds.open}`);
  assert(col.solid === false, `open door should not be solid`);
  assert(col.blocksSight === false, `open door should not block sight`);

  // Intent should be consumed
  assert(!world.has(actor, InteractIntent), 'InteractIntent should be consumed');

  // --- Toggle door: open -> closed ---
  world.add(actor, InteractIntent, { targetId: door });
  interactionSystem(world);

  ds = world.get(door, DoorState);
  col = world.get(door, Collider);
  assert(ds.open === false, `door should be closed again`);
  assert(col.solid === true, `closed door should be solid`);
  assert(col.blocksSight === true, `closed door should block sight`);

  // --- Locked door: should stay closed ---
  world.set(door, DoorState, { open: false, locked: true });
  world.add(actor, InteractIntent, { targetId: door });

  const events = [];
  world.on('interaction', e => events.push(e));
  interactionSystem(world);

  ds = world.get(door, DoorState);
  assert(ds.open === false, 'locked door should stay closed');
  assert(events.some(e => e.result === 'locked'), 'should emit locked interaction event');

  // --- Open chest emits event ---
  const chest = world.create();
  world.add(chest, Interactable, { action: 'openChest', params: { lootTable: 'gold' } });

  world.add(actor, InteractIntent, { targetId: chest });
  const chestEvents = [];
  world.on('interaction', e => { if (e.action === 'openChest') chestEvents.push(e); });
  interactionSystem(world);

  assert(chestEvents.length === 1, 'should emit openChest event');
  assert(chestEvents[0].loot === 'gold', `loot should be 'gold', got ${chestEvents[0].loot}`);

  // --- Read text emits event ---
  const sign = world.create();
  world.add(sign, Interactable, { action: 'readText', params: { textId: 'intro' } });

  world.add(actor, InteractIntent, { targetId: sign });
  const textEvents = [];
  world.on('interaction', e => { if (e.action === 'readText') textEvents.push(e); });
  interactionSystem(world);

  assert(textEvents.length === 1, 'should emit readText event');
  assert(textEvents[0].textId === 'intro', `textId should be 'intro'`);

  console.log('Interaction tests PASS');
}

run().catch(e => { console.error(e); process.exitCode = 1; });
