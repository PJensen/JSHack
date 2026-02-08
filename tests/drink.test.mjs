import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Potion } from '../src/rules/components/Potion.js';
import { Inventory } from '../src/rules/components/Inventory.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { ActiveEffects } from '../src/rules/components/ActiveEffects.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { DrinkIntent } from '../src/rules/components/Intents/DrinkIntent.js';
import { drinkSystem } from '../src/rules/systems/drinkSystem.js';

Deno.test("drinking a single-dose potion applies effect and destroys it", () => {
  const world = new World({ seed: 1 });

  const actor = world.create();
  world.add(actor, Vitality, { maxHp: 50, hp: 30 });
  world.add(actor, Inventory, { items: [], maxWeight: 100 });

  const potion = world.create();
  world.add(potion, Potion, {
    name: 'Healing Potion', route: 'oral', doses: 1, channels: [],
    effects: [{ key: 'regeneration', potency: 5, onset: 0, peak: 0, duration: 3, stack: 'add' }],
    toxicity: null
  });
  world.add(potion, ItemInfo, { type: 'potion', slot: '', weight: 1, value: 10, description: '', count: 1, bonuses: {}, rarity: 1, rarityName: 'common', affixes: [] });

  const inv = world.get(actor, Inventory);
  inv.items.push(potion);

  world.add(actor, DrinkIntent, { itemId: potion, targetId: 0 });
  drinkSystem(world);

  assert(!world.has(actor, DrinkIntent), 'DrinkIntent should be consumed');

  const ae = world.get(actor, ActiveEffects);
  assert(ae && ae.effects.length === 1, `should have 1 effect, got ${ae?.effects?.length}`);
  assert(ae.effects[0].key === 'regeneration', `effect key should be regeneration, got ${ae.effects[0].key}`);
  assert(ae.effects[0].potency === 5, `potency should be 5, got ${ae.effects[0].potency}`);
  assert(ae.effects[0].turnsLeft === 3, `duration should be 3, got ${ae.effects[0].turnsLeft}`);

  assert(!world.isAlive(potion), 'empty potion should be destroyed');
  assert(!inv.items.includes(potion), 'potion should be removed from inventory');
});

Deno.test("drinking from a stacked potion decrements count", () => {
  const world = new World({ seed: 1 });

  const actor = world.create();
  world.add(actor, Vitality, { maxHp: 50, hp: 50 });
  world.add(actor, Inventory, { items: [], maxWeight: 100 });

  const stack = world.create();
  world.add(stack, Potion, {
    name: 'Mana Flask', route: 'oral', doses: 1, channels: [],
    effects: [{ key: 'mana_restore', potency: 10, onset: 0, peak: 0, duration: 1, stack: 'add' }],
    toxicity: null
  });
  world.add(stack, ItemInfo, { type: 'potion', slot: '', weight: 1, value: 5, description: '', count: 3, bonuses: {}, rarity: 1, rarityName: 'common', affixes: [] });

  const inv = world.get(actor, Inventory);
  inv.items.push(stack);

  world.add(actor, DrinkIntent, { itemId: stack, targetId: 0 });
  drinkSystem(world);

  const info = world.get(stack, ItemInfo);
  assert(world.isAlive(stack), 'stacked potion should still exist');
  assert(info.count === 2, `stack count should be 2, got ${info.count}`);
});

Deno.test("DrinkIntent on non-Potion item is consumed harmlessly", () => {
  const world = new World({ seed: 1 });

  const rock = world.create();
  const actor = world.create();
  world.add(actor, DrinkIntent, { itemId: rock, targetId: 0 });
  drinkSystem(world);
  assert(!world.has(actor, DrinkIntent), 'invalid drink intent should be consumed');
});

Deno.test("toxic potion schedules hangover effect", () => {
  const world = new World({ seed: 1 });

  const actor = world.create();
  world.add(actor, Vitality, { maxHp: 100, hp: 100 });
  world.add(actor, Inventory, { items: [], maxWeight: 100 });

  const toxicBrew = world.create();
  world.add(toxicBrew, Potion, {
    name: 'Toxic Brew', route: 'oral', doses: 1, channels: [],
    effects: [{ key: 'strength', potency: 10, onset: 0, peak: 0, duration: 10, stack: 'add' }],
    toxicity: { hangover: 3 }
  });
  world.add(toxicBrew, ItemInfo, { type: 'potion', slot: '', weight: 1, value: 5, description: '', count: 1, bonuses: {}, rarity: 1, rarityName: 'common', affixes: [] });

  const inv = world.get(actor, Inventory);
  inv.items.push(toxicBrew);

  world.add(actor, DrinkIntent, { itemId: toxicBrew, targetId: 0 });
  drinkSystem(world);

  const ae = world.get(actor, ActiveEffects);
  const hangover = ae.effects.find(e => e.key === 'hangover');
  assert(hangover, 'should schedule a hangover effect');
  assert(hangover.potency === 3, `hangover potency should be 3, got ${hangover.potency}`);
});
