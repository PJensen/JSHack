import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Interactable } from '../src/rules/components/Interactable.js';
import { InteractIntent } from '../src/rules/components/Intents/InteractIntent.js';
import { DoorState } from '../src/rules/components/DoorState.js';
import { Collider } from '../src/rules/components/Collider.js';
import { Inventory } from '../src/rules/components/Inventory.js';
import { HarvestNode } from '../src/rules/components/HarvestNode.js';
import { Position } from '../src/rules/components/Position.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { Mana } from '../src/rules/components/Mana.js';
import { Stamina } from '../src/rules/components/Stamina.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { HazardArea } from '../src/rules/components/HazardArea.js';
import { Potion } from '../src/rules/components/Potion.js';
import { createFrom } from '../src/lib/ecs-js/archetype.js';
import { WildBerries, WildHerbs, ThornPods, VenomFronds } from '../src/rules/archetypes/Food.js';
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

Deno.test("open chest emits chest:open event", () => {
  const world = new World({ seed: 1 });

  const actor = world.create();
  const chest = world.create();
  world.add(chest, Interactable, { action: 'openChest', params: {} });
  world.add(chest, Inventory, { items: [100, 101], capacity: 20, weightLimit: null });

  world.add(actor, InteractIntent, { targetId: chest });
  const chestEvents = [];
  world.on('chest:open', e => chestEvents.push(e));
  interactionSystem(world);

  assert(chestEvents.length === 1, 'should emit chest:open event');
  assert(chestEvents[0].targetId === chest, 'event should reference the chest');
  assert(chestEvents[0].chestItems.length === 2, 'should include chest items');
});

Deno.test("chest remains interactable after opening", () => {
  const world = new World({ seed: 1 });

  const actor = world.create();
  const chest = world.create();
  world.add(chest, Interactable, { action: 'openChest', params: {} });
  world.add(chest, Inventory, { items: [], capacity: 20, weightLimit: null });

  // Open chest twice
  world.add(actor, InteractIntent, { targetId: chest });
  interactionSystem(world);
  world.add(actor, InteractIntent, { targetId: chest });
  interactionSystem(world);

  assert(world.has(chest, Interactable), 'chest should still be interactable after multiple opens');
});

Deno.test("chest:open event includes copy of items", () => {
  const world = new World({ seed: 1 });

  const actor = world.create();
  const chest = world.create();
  world.add(chest, Interactable, { action: 'openChest', params: {} });
  world.add(chest, Inventory, { items: [42, 43, 44], capacity: 20, weightLimit: null });

  const events = [];
  world.on('chest:open', e => events.push(e));

  world.add(actor, InteractIntent, { targetId: chest });
  interactionSystem(world);

  assert(events.length === 1);
  assert(Array.isArray(events[0].chestItems));
  assert(events[0].chestItems.length === 3);
  // Ensure it's a copy, not a reference
  events[0].chestItems.push(999);
  const inv = world.get(chest, Inventory);
  assert(inv.items.length === 3, 'original inventory should be unchanged');
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

Deno.test("stairs do not emit stair traversal from interactionSystem", () => {
  const world = new World({ seed: 1 });
  const actor = world.create();
  const stairDown = world.create();
  const stairUp = world.create();

  world.add(stairDown, Interactable, { action: 'descendStair', params: null });
  world.add(stairUp, Interactable, { action: 'ascendStair', params: null });

  const stairEvents = [];
  world.on('stair:traverse', e => stairEvents.push(e));

  world.add(actor, InteractIntent, { targetId: stairDown });
  interactionSystem(world);
  world.add(actor, InteractIntent, { targetId: stairUp });
  interactionSystem(world);

  assert(stairEvents.length === 0, 'stairs should be traversed only by UI flow');
});

Deno.test("harvest node creates food and enters regrow cooldown", () => {
  const world = new World({ seed: 17 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], capacity: 20, weightLimit: null });

  const node = world.create();
  world.add(node, Interactable, { action: 'harvestNode', params: { kind: 'berries' } });
  world.add(node, HarvestNode, { kind: 'berries', ready: true, regrowTurns: 9, regrowCountdown: 0 });
  world.add(node, Position, { x: 1, y: 1 });

  const events = [];
  world.on('harvest:picked', (e) => events.push(e));

  world.add(actor, InteractIntent, { targetId: node });
  interactionSystem(world);

  assert(events.length === 1, 'harvest should emit picked event');
  const hn = world.get(node, HarvestNode);
  assert(hn.ready === false, 'node should become unready');
  assert(hn.regrowCountdown === 9, 'node should start regrow countdown');

  const inv = world.get(actor, Inventory);
  assert(inv.items.length >= 1, 'actor should receive harvested item');
  const first = inv.items[0];
  const ni = world.get(first, NamedIdentity);
  const info = world.get(first, ItemInfo);
  assert(ni.identity === 'food_wild_berries', `expected berries, got ${ni.identity}`);
  assert((info.count || 0) >= 1, 'harvest count should be at least 1');
});

Deno.test("harvest node reports empty while regrowing", () => {
  const world = new World({ seed: 19 });
  const actor = world.create();
  const node = world.create();
  world.add(node, Interactable, { action: 'harvestNode', params: { kind: 'herbs' } });
  world.add(node, HarvestNode, { kind: 'herbs', ready: false, regrowTurns: 7, regrowCountdown: 5 });

  const events = [];
  world.on('harvest:empty', (e) => events.push(e));

  world.add(actor, InteractIntent, { targetId: node });
  interactionSystem(world);

  assert(events.length === 1, 'should emit empty harvest event');
  assert(events[0].regrowCountdown === 5, 'should include remaining regrow time');
});

Deno.test("restAtBed restores hp, mana, and stamina", () => {
  const world = new World({ seed: 23 });
  const actor = world.create();
  const bed = world.create();
  world.add(actor, Vitality, { maxHp: 20, hp: 3 });
  world.add(actor, Mana, { maxMana: 12, mana: 1, manaRegen: 0.1 });
  world.add(actor, Stamina, { maxStamina: 100, stamina: 4, staminaRegen: 2, regenCooldown: 9 });
  world.add(bed, Interactable, { action: 'restAtBed', params: null });

  let rested = 0;
  world.on('bed:rested', () => { rested++; });

  world.add(actor, InteractIntent, { targetId: bed });
  interactionSystem(world);

  const v = world.get(actor, Vitality);
  const m = world.get(actor, Mana);
  const s = world.get(actor, Stamina);
  assert(v.hp === v.maxHp, 'hp should be fully restored');
  assert(m.mana === m.maxMana, 'mana should be fully restored');
  assert(s.stamina === s.maxStamina, 'stamina should be fully restored');
  assert((s.regenCooldown || 0) === 0, 'regen cooldown should be reset');
  assert(rested === 1, 'rest event should fire');
});

Deno.test("thorn bramble harvest hurts actor and yields thorn pods", () => {
  const world = new World({ seed: 81 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], capacity: 20, weightLimit: null });
  world.add(actor, Position, { x: 4, y: 4 });
  world.add(actor, Vitality, { maxHp: 20, hp: 20 });

  const node = world.create();
  world.add(node, Interactable, { action: 'harvestNode', params: { kind: 'thorn_bramble' } });
  world.add(node, HarvestNode, { kind: 'thorn_bramble', ready: true, regrowTurns: 11, regrowCountdown: 0 });
  world.add(node, Position, { x: 5, y: 4 });

  const dangerEvents = [];
  world.on('harvest:danger', (e) => dangerEvents.push(e));

  world.add(actor, InteractIntent, { targetId: node });
  interactionSystem(world);

  assert(dangerEvents.some((e) => e.effect === 'thorns'), 'thorn harvest should emit danger event');
  const vit = world.get(actor, Vitality);
  assert(vit.hp < vit.maxHp, 'thorn harvest should damage actor');

  const inv = world.get(actor, Inventory);
  assert(inv.items.length >= 1, 'actor should receive harvested item');
  const first = inv.items[0];
  const ni = world.get(first, NamedIdentity);
  assert(ni.identity === 'reagent_thorn_pod', `expected thorn pods, got ${ni.identity}`);
});

Deno.test("venom fern harvest spawns poison hazard and hurts actor", () => {
  const world = new World({ seed: 82 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], capacity: 20, weightLimit: null });
  world.add(actor, Position, { x: 6, y: 6 });
  world.add(actor, Vitality, { maxHp: 18, hp: 18 });

  const node = world.create();
  world.add(node, Interactable, { action: 'harvestNode', params: { kind: 'venom_fern' } });
  world.add(node, HarvestNode, { kind: 'venom_fern', ready: true, regrowTurns: 14, regrowCountdown: 0 });
  world.add(node, Position, { x: 7, y: 6 });

  const dangerEvents = [];
  world.on('harvest:danger', (e) => dangerEvents.push(e));

  world.add(actor, InteractIntent, { targetId: node });
  interactionSystem(world);

  assert(dangerEvents.some((e) => e.effect === 'spores'), 'venom fern should emit spores danger event');
  const vit = world.get(actor, Vitality);
  assert(vit.hp < vit.maxHp, 'venom fern harvest should damage actor');

  let foundHazard = false;
  for (const [, ni, hazard] of world.query(NamedIdentity, HazardArea)) {
    if (ni.identity === 'venom_spores' && String(hazard.kind) === 'poison') {
      foundHazard = true;
      break;
    }
  }
  assert(foundHazard, 'venom fern harvest should create poison hazard');

  const inv = world.get(actor, Inventory);
  assert(inv.items.length >= 1, 'venom fern should yield a harvested item');
  const first = inv.items[0];
  const ni = world.get(first, NamedIdentity);
  assert(ni.identity === 'reagent_venom_frond', `expected venom fronds, got ${ni.identity}`);
});

Deno.test("alchemy bench opens minigame data, brews legitimate poison, and consumes ingredients", () => {
  const world = new World({ seed: 93 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], capacity: 20, weightLimit: null });
  world.add(actor, Position, { x: 3, y: 3 });

  const berries = createFrom(world, WildBerries, {});
  world.mutate(berries, ItemInfo, (r) => { r.count = 3; });
  const herbs = createFrom(world, WildHerbs, {});
  world.mutate(herbs, ItemInfo, (r) => { r.count = 4; });
  const thornPods = createFrom(world, ThornPods, {});
  world.mutate(thornPods, ItemInfo, (r) => { r.count = 1; });
  const venomFronds = createFrom(world, VenomFronds, {});
  world.mutate(venomFronds, ItemInfo, (r) => { r.count = 2; });
  const inv = world.get(actor, Inventory);
  inv.items.push(berries, herbs, thornPods, venomFronds);

  const bench = world.create();
  world.add(bench, Interactable, { action: 'brewAlchemy', params: null });
  world.add(bench, Position, { x: 4, y: 3 });

  const openEvents = [];
  const crafted = [];
  world.on('alchemy:open', (e) => openEvents.push(e));
  world.on('alchemy:crafted', (e) => crafted.push(e));

  world.add(actor, InteractIntent, { targetId: bench });
  interactionSystem(world);
  assert(openEvents.length === 1, 'bench interaction should emit alchemy:open');
  const venomRecipe = openEvents[0].recipes.find((r) => r.key === 'venom_draft');
  assert(venomRecipe, 'venom recipe should be offered');
  assert((venomRecipe.requirements?.venomFronds || 0) >= 1, 'venom recipe should require venom fronds');

  function countIdentity(identity) {
    let total = 0;
    for (const id of inv.items) {
      const ni = world.get(id, NamedIdentity);
      if (ni?.identity !== identity) continue;
      const info = world.get(id, ItemInfo);
      total += Math.max(1, Number(info?.count || 1) | 0);
    }
    return total;
  }
  const thornBefore = countIdentity('reagent_thorn_pod');
  const venomBefore = countIdentity('reagent_venom_frond');

  world.add(actor, InteractIntent, { targetId: bench, mode: 'brew', recipe: 'venom_draft' });
  interactionSystem(world);
  assert(crafted.length === 1, 'brew mode should craft a potion');
  assert(crafted[0].outputIdentity === 'potion_poison', 'should craft poison potion');

  const invAfter = world.get(actor, Inventory);
  let poisonId = 0;
  for (const id of invAfter.items) {
    const ni = world.get(id, NamedIdentity);
    if (ni?.identity === 'potion_poison') {
      poisonId = id;
      break;
    }
  }
  assert(poisonId > 0, 'inventory should contain crafted poison potion');
  assert(world.has(poisonId, Potion), 'crafted poison should be a legitimate potion entity');
  assert(world.get(poisonId, ItemInfo)?.type === 'potion', 'crafted poison item type should be potion');

  const thornAfter = countIdentity('reagent_thorn_pod');
  const venomAfter = countIdentity('reagent_venom_frond');
  assert(thornAfter < thornBefore, 'thorn pod inventory should be consumed');
  assert(venomAfter < venomBefore, 'venom frond inventory should be consumed');
});
