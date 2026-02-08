import { World } from '../src/lib/ecs-js/index.js';
import { Potion } from '../src/rules/components/Potion.js';
import { Inventory } from '../src/rules/components/Inventory.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { ActiveEffects } from '../src/rules/components/ActiveEffects.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { DrinkIntent } from '../src/rules/components/Intents/DrinkIntent.js';
import { drinkSystem } from '../src/rules/systems/drinkSystem.js';

function assert(c, m) { if (!c) throw new Error('Assertion failed: ' + m); }

async function run() {
  const world = new World({ seed: 1 });

  // --- Basic potion: one dose, single regen effect ---
  const actor = world.create();
  world.add(actor, Vitality, { maxHp: 50, hp: 30 });
  world.add(actor, Inventory, { items: [], maxWeight: 100 });

  const potion = world.create();
  world.add(potion, Potion, {
    name: 'Healing Potion',
    route: 'oral',
    doses: 1,
    channels: [],
    effects: [{ key: 'regeneration', potency: 5, onset: 0, peak: 0, duration: 3, stack: 'add' }],
    toxicity: null
  });
  world.add(potion, ItemInfo, { type: 'potion', slot: '', weight: 1, value: 10, description: '', count: 1, bonuses: {}, rarity: 1, rarityName: 'common', affixes: [] });

  // Put potion in inventory
  const inv = world.get(actor, Inventory);
  inv.items.push(potion);

  // Drink it
  world.add(actor, DrinkIntent, { itemId: potion, targetId: 0 });
  drinkSystem(world);

  // Intent should be consumed
  assert(!world.has(actor, DrinkIntent), 'DrinkIntent should be consumed');

  // ActiveEffects should have the regeneration effect
  const ae = world.get(actor, ActiveEffects);
  assert(ae && ae.effects.length === 1, `should have 1 effect, got ${ae?.effects?.length}`);
  assert(ae.effects[0].key === 'regeneration', `effect key should be regeneration, got ${ae.effects[0].key}`);
  assert(ae.effects[0].potency === 5, `potency should be 5, got ${ae.effects[0].potency}`);
  assert(ae.effects[0].turnsLeft === 3, `duration should be 3, got ${ae.effects[0].turnsLeft}`);

  // Potion entity should be destroyed (single dose, count=1)
  assert(!world.isAlive(potion), 'empty potion should be destroyed');

  // Potion should be removed from inventory
  assert(!inv.items.includes(potion), 'potion should be removed from inventory');

  // --- Stacked potion: count=3, one dose each ---
  const actor2 = world.create();
  world.add(actor2, Vitality, { maxHp: 50, hp: 50 });
  world.add(actor2, Inventory, { items: [], maxWeight: 100 });

  const stack = world.create();
  world.add(stack, Potion, {
    name: 'Mana Flask',
    route: 'oral',
    doses: 1,
    channels: [],
    effects: [{ key: 'mana_restore', potency: 10, onset: 0, peak: 0, duration: 1, stack: 'add' }],
    toxicity: null
  });
  world.add(stack, ItemInfo, { type: 'potion', slot: '', weight: 1, value: 5, description: '', count: 3, bonuses: {}, rarity: 1, rarityName: 'common', affixes: [] });

  const inv2 = world.get(actor2, Inventory);
  inv2.items.push(stack);

  world.add(actor2, DrinkIntent, { itemId: stack, targetId: 0 });
  drinkSystem(world);

  // Stack should decrement but item should survive
  const info = world.get(stack, ItemInfo);
  assert(world.isAlive(stack), 'stacked potion should still exist');
  assert(info.count === 2, `stack count should be 2, got ${info.count}`);

  // --- Non-potion item: DrinkIntent on non-Potion should be consumed harmlessly ---
  const rock = world.create();
  const actor3 = world.create();
  world.add(actor3, DrinkIntent, { itemId: rock, targetId: 0 });
  drinkSystem(world);
  assert(!world.has(actor3, DrinkIntent), 'invalid drink intent should be consumed');

  // --- Hangover scheduling ---
  const actor4 = world.create();
  world.add(actor4, Vitality, { maxHp: 100, hp: 100 });
  world.add(actor4, Inventory, { items: [], maxWeight: 100 });

  const toxicBrew = world.create();
  world.add(toxicBrew, Potion, {
    name: 'Toxic Brew',
    route: 'oral',
    doses: 1,
    channels: [],
    effects: [{ key: 'strength', potency: 10, onset: 0, peak: 0, duration: 10, stack: 'add' }],
    toxicity: { hangover: 3 }
  });
  world.add(toxicBrew, ItemInfo, { type: 'potion', slot: '', weight: 1, value: 5, description: '', count: 1, bonuses: {}, rarity: 1, rarityName: 'common', affixes: [] });

  const inv4 = world.get(actor4, Inventory);
  inv4.items.push(toxicBrew);

  world.add(actor4, DrinkIntent, { itemId: toxicBrew, targetId: 0 });
  drinkSystem(world);

  const ae4 = world.get(actor4, ActiveEffects);
  const hangover = ae4.effects.find(e => e.key === 'hangover');
  assert(hangover, 'should schedule a hangover effect');
  assert(hangover.potency === 3, `hangover potency should be 3, got ${hangover.potency}`);

  console.log('Drink system tests PASS');
}

run().catch(e => { console.error(e); process.exitCode = 1; });
