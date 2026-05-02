import "./helpers/installContentCatalog.mjs";
// @ts-nocheck
import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { createPlayer } from '../src/rules/archetypes/Player.js';
import { Inventory } from '../src/rules/components/Inventory.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { Brain } from '../src/rules/components/Brain.js';
import { UseIntent } from '../src/rules/components/Intents/UseIntent.js';
import { useItemSystem } from '../src/rules/systems/useItemSystem.js';
import { addToInventory, inventoryContains } from "../src/rules/utils/inventoryFacade.js";

function scheduler(world) {
  try { useItemSystem(world); } catch (e) { console.error('use system error', e); }
}

function makeLightningBook(world) {
  const id = world.create();
  world.add(id, NamedIdentity, { name: 'Spellbook of Lightning', identity: 'book_lightning' });
  world.add(id, ItemInfo, { type: 'learn', slot: 'brain', weight: 1, value: 0, description: 'Teaches lightning', count: 1 });
  return id;
}

function makeSpellBook(world, spellId, spellName) {
  const id = world.create();
  world.add(id, NamedIdentity, { name: `Spellbook of ${spellName}`, identity: `book_${spellId}` });
  world.add(id, ItemInfo, { type: 'learn', slot: 'brain', weight: 1, value: 0, description: `Teaches ${spellName}`, count: 1 });
  return id;
}

Deno.test("using a spellbook teaches the spell and consumes the book", () => {
  const world = new World({ seed: 1 });
  world.setScheduler((w) => scheduler(w));

  const player = createPlayer(world, { name: 'Mage' });
  const brain = world.get(player, Brain);

  assert(world.has(player, Inventory), 'player has inventory');
  assert(brain, 'player has brain');

  const book = makeLightningBook(world);
  addToInventory(world, player, book);

  world.add(player, UseIntent, { itemId: book });
  world.tick(1);

  const brain2 = world.get(player, Brain);
  assert(Array.isArray(brain2.learnedSpellIds) && brain2.learnedSpellIds.includes('lightning'), 'learned lightning');
  assert(!inventoryContains(world, player, book), 'book consumed');
  assert(!world.isAlive(book), 'book entity destroyed');
});

Deno.test("storm spellbooks teach blizzard and firestorm", () => {
  const world = new World({ seed: 2 });
  world.setScheduler((w) => scheduler(w));

  const player = createPlayer(world, { name: 'Storm Mage' });
  const books = [
    makeSpellBook(world, 'blizzard', 'Blizzard'),
    makeSpellBook(world, 'firestorm', 'Firestorm'),
  ];

  for (const book of books) {
    addToInventory(world, player, book);
    world.add(player, UseIntent, { itemId: book });
    world.tick(1);
  }

  const brain = world.get(player, Brain);
  assert(Array.isArray(brain.learnedSpellIds) && brain.learnedSpellIds.includes('blizzard'), 'learned blizzard');
  assert(Array.isArray(brain.learnedSpellIds) && brain.learnedSpellIds.includes('firestorm'), 'learned firestorm');
  for (const book of books) {
    assert(!inventoryContains(world, player, book), `book ${book} consumed`);
    assert(!world.isAlive(book), `book ${book} destroyed`);
  }
});
