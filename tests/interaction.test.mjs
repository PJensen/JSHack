import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Interactable } from '../src/rules/components/Interactable.js';
import { InteractIntent } from '../src/rules/components/Intents/InteractIntent.js';
import { DoorState } from '../src/rules/components/DoorState.js';
import { Collider } from '../src/rules/components/Collider.js';
import { interactionSystem } from '../src/rules/systems/interactionSystem.js';

Deno.test("toggle door: closed → open → closed", () => {
  const world = new World({ seed: 1 });

  const actor = world.create();
  const door = world.create();
  world.add(door, Interactable, { action: 'toggleDoor', params: null });
  world.add(door, DoorState, { open: false, locked: false });
  world.add(door, Collider, { solid: true, blocksSight: true });

  // Open
  world.add(actor, InteractIntent, { targetId: door });
  interactionSystem(world);

  let ds = world.get(door, DoorState);
  let col = world.get(door, Collider);
  assert(ds.open === true, `door should be open, got ${ds.open}`);
  assert(col.solid === false, 'open door should not be solid');
  assert(col.blocksSight === false, 'open door should not block sight');
  assert(!world.has(actor, InteractIntent), 'InteractIntent should be consumed');

  // Close
  world.add(actor, InteractIntent, { targetId: door });
  interactionSystem(world);

  ds = world.get(door, DoorState);
  col = world.get(door, Collider);
  assert(ds.open === false, 'door should be closed again');
  assert(col.solid === true, 'closed door should be solid');
  assert(col.blocksSight === true, 'closed door should block sight');
});

Deno.test("locked door stays closed and emits locked event", () => {
  const world = new World({ seed: 1 });

  const actor = world.create();
  const door = world.create();
  world.add(door, Interactable, { action: 'toggleDoor', params: null });
  world.add(door, DoorState, { open: false, locked: true });
  world.add(door, Collider, { solid: true, blocksSight: true });

  world.add(actor, InteractIntent, { targetId: door });

  const events = [];
  world.on('interaction', e => events.push(e));
  interactionSystem(world);

  const ds = world.get(door, DoorState);
  assert(ds.open === false, 'locked door should stay closed');
  assert(events.some(e => e.result === 'locked'), 'should emit locked interaction event');
});

Deno.test("open chest emits event with loot", () => {
  const world = new World({ seed: 1 });

  const actor = world.create();
  const chest = world.create();
  world.add(chest, Interactable, { action: 'openChest', params: { lootTable: 'gold' } });

  world.add(actor, InteractIntent, { targetId: chest });
  const chestEvents = [];
  world.on('interaction', e => { if (e.action === 'openChest') chestEvents.push(e); });
  interactionSystem(world);

  assert(chestEvents.length === 1, 'should emit openChest event');
  assert(chestEvents[0].loot === 'gold', `loot should be 'gold', got ${chestEvents[0].loot}`);
});

Deno.test("read text emits event with textId", () => {
  const world = new World({ seed: 1 });

  const actor = world.create();
  const sign = world.create();
  world.add(sign, Interactable, { action: 'readText', params: { textId: 'intro' } });

  world.add(actor, InteractIntent, { targetId: sign });
  const textEvents = [];
  world.on('interaction', e => { if (e.action === 'readText') textEvents.push(e); });
  interactionSystem(world);

  assert(textEvents.length === 1, 'should emit readText event');
  assert(textEvents[0].textId === 'intro', `textId should be 'intro'`);
});
