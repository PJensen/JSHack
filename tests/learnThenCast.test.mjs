// @ts-nocheck
import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { createPlayer } from '../src/rules/archetypes/Player.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { addToInventory } from "../src/rules/utils/inventoryFacade.js";
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { Brain } from '../src/rules/components/Brain.js';
import { Mana } from '../src/rules/components/Mana.js';
import { UseIntent } from '../src/rules/components/Intents/UseIntent.js';
import { CastSpellIntent } from '../src/rules/components/Intents/CastSpellIntent.js';
import { useItemSystem } from '../src/rules/systems/useItemSystem.js';
import { castSpellSystem } from '../src/rules/systems/castSpellSystem.js';

function scheduler(world) {
  try { useItemSystem(world); } catch (e) { console.error('use system error', e); }
  try { castSpellSystem(world); } catch (e) { console.error('cast system error', e); }
}

Deno.test("learn spell then cast spell in separate ticks", () => {
  const world = new World({ seed: 1 });
  world.setScheduler((w) => scheduler(w));

  const player = createPlayer(world, { name: 'Mage' });
  const brain = world.get(player, Brain);
  const mana = world.get(player, Mana);
  mana.mana = 50; mana.maxMana = 50;

  // Create spellbook and put in inventory
  const book = world.create();
  world.add(book, NamedIdentity, { name: 'Spellbook of Lightning', identity: 'book_lightning' });
  world.add(book, ItemInfo, { type: 'learn', slot: 'brain', weight: 1, value: 0, description: 'Teaches lightning', count: 1 });
  addToInventory(world, player, book);

  console.log('Before learning - brain.learnedSpellIds:', JSON.stringify(brain.learnedSpellIds));

  // Tick 1: learn spell
  world.add(player, UseIntent, { itemId: book });
  world.tick(1);

  const brainAfterLearn = world.get(player, Brain);
  console.log('After learning - brain.learnedSpellIds:', JSON.stringify(brainAfterLearn.learnedSpellIds));
  assert(brainAfterLearn.learnedSpellIds.includes('lightning'), 'should have learned lightning');

  // Tick 2: cast spell
  const events = [];
  world.on('castSpell', (e) => events.push(e));
  world.on('spell:not-known', (e) => { console.log('spell:not-known event!', e); events.push({ type: 'not-known', ...e }); });

  world.add(player, CastSpellIntent, { spellId: 'lightning' });

  const brainBeforeCast = world.get(player, Brain);
  console.log('Before casting - brain.learnedSpellIds:', JSON.stringify(brainBeforeCast.learnedSpellIds));

  world.tick(1);

  const brainAfterCast = world.get(player, Brain);
  console.log('After casting - brain.learnedSpellIds:', JSON.stringify(brainAfterCast.learnedSpellIds));

  const castEvents = events.filter(e => e.spellId === 'lightning' && !e.type);
  assert(castEvents.length > 0, 'should have cast lightning, got events: ' + JSON.stringify(events));
});
