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
import { Consumable } from '../src/rules/components/Consumable.js';
import { FoodDecay } from '../src/rules/components/FoodDecay.js';
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
  world.add(node, HarvestNode, {
    kind: 'berries', ready: true, regrowTurns: 9, regrowCountdown: 0,
    yield: 'food_wild_berries', yieldMin: 1, yieldMax: 3,
  });
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
  world.add(node, HarvestNode, {
    kind: 'thorn_bramble', ready: true, regrowTurns: 11, regrowCountdown: 0,
    yield: 'reagent_thorn_pod', yieldMin: 2, yieldMax: 4,
    danger: { type: 'physical', dmgMin: 1, dmgMax: 3, cause: 'thorn_bramble' },
  });
  world.add(node, Position, { x: 5, y: 4 });

  const dangerEvents = [];
  world.on('harvest:danger', (e) => dangerEvents.push(e));

  world.add(actor, InteractIntent, { targetId: node });
  interactionSystem(world);

  assert(dangerEvents.some((e) => e.effect === 'physical'), 'thorn harvest should emit physical danger event');
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
  world.add(node, HarvestNode, {
    kind: 'venom_fern', ready: true, regrowTurns: 14, regrowCountdown: 0,
    yield: 'reagent_venom_frond', yieldMin: 2, yieldMax: 3,
    danger: { type: 'poison', dmgMin: 1, dmgMax: 2, cause: 'venom_fern' },
    hazard: { kind: 'poison', turnsLeft: 2, tickDamage: 1, identity: 'venom_spores', name: 'Venom Spores' },
  });
  world.add(node, Position, { x: 7, y: 6 });

  const dangerEvents = [];
  world.on('harvest:danger', (e) => dangerEvents.push(e));

  world.add(actor, InteractIntent, { targetId: node });
  interactionSystem(world);

  assert(dangerEvents.some((e) => e.effect === 'poison'), 'venom fern should emit poison danger event');
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

// ── Sarcophagus ───────────────────────────────────────────────────────────────

Deno.test("sarcophagus: spawns skeleton on first interaction", () => {
  const world = new World({ seed: 42 });

  const actor = world.create();
  const sarc = world.create();
  world.add(sarc, Interactable, { action: 'openSarcophagus', params: null });
  world.add(sarc, Position, { x: 5, y: 5 });

  const events = [];
  world.on('sarcophagus:opened', (e) => events.push(e));

  world.add(actor, InteractIntent, { targetId: sarc });
  interactionSystem(world);

  assert(events.length === 1, 'should emit sarcophagus:opened');
  assert(events[0].targetId === sarc, 'event should reference the sarcophagus');

  let skeletonFound = false;
  for (const [, ni] of world.query(NamedIdentity)) {
    if (ni.identity === 'skeleton') { skeletonFound = true; break; }
  }
  assert(skeletonFound, 'a skeleton should be spawned');
});

Deno.test("sarcophagus: becomes inert after opening (one-time use)", () => {
  const world = new World({ seed: 43 });

  const actor = world.create();
  const sarc = world.create();
  world.add(sarc, Interactable, { action: 'openSarcophagus', params: null });
  world.add(sarc, Position, { x: 3, y: 3 });

  world.add(actor, InteractIntent, { targetId: sarc });
  interactionSystem(world);

  assert(!world.has(sarc, Interactable), 'sarcophagus should lose Interactable after opening');

  // Second interaction should be a no-op (no Interactable component).
  const events = [];
  world.on('sarcophagus:opened', (e) => events.push(e));
  world.add(actor, InteractIntent, { targetId: sarc });
  interactionSystem(world);

  assert(events.length === 0, 'second interaction should do nothing');
});

// ── Altar — two-phase offering ────────────────────────────────────────────────

Deno.test("altar: phase 1 emits offer prompt with inventory items", () => {
  const world = new World({ seed: 50 });

  const actor = world.create();
  const altar = world.create();
  world.add(altar, Interactable, { action: 'prayAltar', params: null });
  world.add(actor, Inventory, { items: [], capacity: 10, weightLimit: null });

  // Put an item in inventory.
  const itemId = world.create();
  world.add(itemId, ItemInfo, {
    type: 'potion', slot: 'bag', weight: 1, value: 50,
    description: 'test', count: 1, bonuses: {}, rarity: 1, rarityName: 'common', affixes: [],
  });
  world.get(actor, Inventory).items.push(itemId);

  const prompts = [];
  world.on('altar:offerPrompt', (e) => prompts.push(e));

  world.add(actor, InteractIntent, { targetId: altar });
  interactionSystem(world);

  assert(prompts.length === 1, 'should emit altar:offerPrompt');
  assert(prompts[0].items.includes(itemId), 'prompt should include the offerable item');
});

Deno.test("altar: phase 2 consumes item and emits altar:offer", () => {
  const world = new World({ seed: 51 });

  const actor = world.create();
  const altar = world.create();
  world.add(altar, Interactable, { action: 'prayAltar', params: null });
  world.add(actor, Inventory, { items: [], capacity: 10, weightLimit: null });

  const itemId = world.create();
  world.add(itemId, ItemInfo, {
    type: 'potion', slot: 'bag', weight: 1, value: 50,
    description: 'test', count: 1, bonuses: {}, rarity: 1, rarityName: 'common', affixes: [],
  });
  world.get(actor, Inventory).items.push(itemId);

  const offers = [];
  world.on('altar:offer', (e) => offers.push(e));

  // Phase 2: offer the selected item.
  world.add(actor, InteractIntent, { targetId: altar, mode: 'offer', itemId });
  interactionSystem(world);

  assert(offers.length === 1, 'should emit altar:offer');
  assert(offers[0].value === 0.25, 'should report normalized value (50/200)');
  assert(offers[0].itemName === 'test', 'should report item name');
  const inv = world.get(actor, Inventory);
  assert(!inv.items.includes(itemId), 'offered item should be removed from inventory');
});

Deno.test("altar: offer fails gracefully when item is not in inventory", () => {
  const world = new World({ seed: 52 });

  const actor = world.create();
  const altar = world.create();
  world.add(altar, Interactable, { action: 'prayAltar', params: null });
  world.add(actor, Inventory, { items: [], capacity: 10, weightLimit: null });

  const failures = [];
  world.on('altar:offerFailed', (e) => failures.push(e));

  // Try to offer an item that isn't in inventory.
  world.add(actor, InteractIntent, { targetId: altar, mode: 'offer', itemId: 9999 });
  interactionSystem(world);

  assert(failures.length === 1, 'should emit altar:offerFailed');
  assert(failures[0].reason === 'not_owned', 'should explain the failure reason');
});

// ── Cooking fire ──────────────────────────────────────────────────────────────

Deno.test("cooking fire: phase 1 emits cooking:open with corpses and herbs", () => {
  const world = new World({ seed: 70 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], capacity: 20, weightLimit: null });
  world.add(actor, Position, { x: 3, y: 3 });

  // Add a corpse to inventory.
  const corpse = world.create();
  world.add(corpse, NamedIdentity, { name: "Rat Corpse", identity: "corpse_rat" });
  world.add(corpse, ItemInfo, { type: "food", weight: 2, value: 5, count: 1 });
  world.add(corpse, Consumable, { effectParams: { nutrition: 150, corpseIdentity: "corpse_rat" }, remainingUses: 1, potency: 0 });
  world.add(corpse, FoodDecay, { turnsHeld: 20, shelfLife: 150 });
  const inv = world.get(actor, Inventory);
  inv.items.push(corpse);

  // Add herbs to inventory.
  const herbs = createFrom(world, WildHerbs, {});
  world.mutate(herbs, ItemInfo, (r) => { r.count = 3; });
  inv.items.push(herbs);

  const fire = world.create();
  world.add(fire, Interactable, { action: 'cookFood', params: null });
  world.add(fire, Position, { x: 4, y: 3 });

  const openEvents = [];
  world.on('cooking:open', (e) => openEvents.push(e));

  world.add(actor, InteractIntent, { targetId: fire });
  interactionSystem(world);

  assert(openEvents.length === 1, 'should emit cooking:open');
  assert(Array.isArray(openEvents[0].corpses), 'should include corpses array');
  assert(openEvents[0].corpses.length === 1, 'should list the one corpse');
  assert(openEvents[0].corpses[0] === corpse, 'corpse entity id should match');
  assert(openEvents[0].herbs.count === 3, 'should count herbs');
});

Deno.test("cooking fire: phase 2 transmogrifies corpse into ration", () => {
  const world = new World({ seed: 71 });
  world.setScheduler((w) => { interactionSystem(w); });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], capacity: 20, weightLimit: null });
  world.add(actor, Position, { x: 3, y: 3 });

  // Add a corpse to inventory.
  const corpse = world.create();
  world.add(corpse, NamedIdentity, { name: "Orc Corpse", identity: "corpse_orc" });
  world.add(corpse, ItemInfo, { type: "food", weight: 4, value: 10, count: 1 });
  world.add(corpse, Consumable, { effectParams: { nutrition: 300, corpseIdentity: "corpse_orc" }, remainingUses: 1, potency: 0 });
  world.add(corpse, FoodDecay, { turnsHeld: 50, shelfLife: 150 });
  const inv = world.get(actor, Inventory);
  inv.items.push(corpse);

  const fire = world.create();
  world.add(fire, Interactable, { action: 'cookFood', params: null });
  world.add(fire, Position, { x: 4, y: 3 });

  const cooked = [];
  world.on('cooking:cooked', (e) => cooked.push(e));

  // Dispatch through tick() like the real game does, so ECS deferral is active.
  world.add(actor, InteractIntent, { targetId: fire, mode: 'cook', itemId: corpse });
  world.tick(1);

  assert(cooked.length === 1, 'should emit cooking:cooked');
  assert(cooked[0].itemId === corpse, 'cooked event should reference the item');

  // The corpse entity should now be a ration (same entity id, new identity).
  const ni = world.get(corpse, NamedIdentity);
  assert(ni.identity === 'food_ration', `expected food_ration, got ${ni.identity}`);
  assert(inv.items.includes(corpse), 'ration should still be in inventory');

  // FoodDecay should be reset to fresh with ration shelf life.
  const fd = world.get(corpse, FoodDecay);
  assert(fd.turnsHeld === 0, 'turnsHeld should be reset to 0');
  assert(fd.shelfLife === 500, `shelfLife should be 500 (ration), got ${fd.shelfLife}`);
});

Deno.test("cooking fire: no corpses emits cooking:open with empty list", () => {
  const world = new World({ seed: 72 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], capacity: 20, weightLimit: null });

  const fire = world.create();
  world.add(fire, Interactable, { action: 'cookFood', params: null });

  const openEvents = [];
  world.on('cooking:open', (e) => openEvents.push(e));

  world.add(actor, InteractIntent, { targetId: fire });
  interactionSystem(world);

  assert(openEvents.length === 1, 'should emit cooking:open');
  assert(openEvents[0].corpses.length === 0, 'corpses should be empty');
});

Deno.test("cooking fire: cooking item not in inventory emits cooking:failed", () => {
  const world = new World({ seed: 73 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], capacity: 20, weightLimit: null });

  const fire = world.create();
  world.add(fire, Interactable, { action: 'cookFood', params: null });

  const failures = [];
  world.on('cooking:failed', (e) => failures.push(e));

  world.add(actor, InteractIntent, { targetId: fire, mode: 'cook', itemId: 9999 });
  interactionSystem(world);

  assert(failures.length === 1, 'should emit cooking:failed');
  assert(failures[0].reason === 'not_owned', 'reason should be not_owned');
});

Deno.test("fountain has finite uses and becomes dry", () => {
  const world = new World({ seed: 88 });
  const actor = world.create();
  world.add(actor, Vitality, { maxHp: 20, hp: 8 });

  const fountain = world.create();
  world.add(fountain, Interactable, {
    action: 'drinkFountain',
    params: { chargesRemaining: 2, primaryEffect: 'heal' },
  });

  const drinks = [];
  const dry = [];
  world.on('fountain:drink', (e) => drinks.push(e));
  world.on('fountain:dry', (e) => dry.push(e));

  world.add(actor, InteractIntent, { targetId: fountain });
  interactionSystem(world);
  world.add(actor, InteractIntent, { targetId: fountain });
  interactionSystem(world);
  world.add(actor, InteractIntent, { targetId: fountain });
  interactionSystem(world);

  const inter = world.get(fountain, Interactable);
  assert((inter?.params?.chargesRemaining | 0) === 0, 'fountain should have no charges left');
  assert(drinks.length === 2, `expected 2 successful drinks, got ${drinks.length}`);
  assert(dry.length >= 1, 'dry event should be emitted once depleted');
});

Deno.test("fountain beneficial effect is stable per fountain", () => {
  const world = new World({ seed: 89 });
  const actor = world.create();
  world.add(actor, Vitality, { maxHp: 20, hp: 20 });
  world.add(actor, Mana, { maxMana: 12, mana: 1, manaRegen: 0.1 });

  const fountain = world.create();
  world.add(fountain, Interactable, {
    action: 'drinkFountain',
    params: { chargesRemaining: 20, primaryEffect: 'mana' },
  });

  const drinks = [];
  world.on('fountain:drink', (e) => drinks.push(e));

  for (let i = 0; i < 12; i++) {
    world.step = i;
    world.add(actor, InteractIntent, { targetId: fountain });
    interactionSystem(world);
  }

  const beneficial = drinks.filter((e) => e.effect === 'heal' || e.effect === 'mana');
  assert(beneficial.length > 0, 'expected at least one beneficial fountain roll');
  assert(beneficial.every((e) => e.effect === 'mana'), 'mana fountain should never emit heal effect');
});
