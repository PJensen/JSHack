import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { AttackIntent } from '../src/rules/components/Intents/AttackIntent.js';
import { Equipment } from '../src/rules/components/Equipment.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { ActiveEffects } from '../src/rules/components/ActiveEffects.js';
import { Pet } from '../src/rules/components/Pet.js';
import { Owner } from '../src/rules/components/Owner.js';
import { equipmentSystem } from '../src/rules/systems/equipmentSystem.js';
import { combatSystem } from '../src/rules/systems/combatSystem.js';
import { cleanupSystem } from '../src/rules/systems/cleanupSystem.js';
import { Position } from '../src/rules/components/Position.js';
import { Inventory } from '../src/rules/components/Inventory.js';
import { addToInventory } from '../src/rules/utils/inventoryFacade.js';
import { clearAll, loadChunk } from '../src/rules/environment/dungeon/tileMap.js';
import { CHUNK_SIZE, TILE_FLOOR } from '../src/rules/environment/dungeon/constants.js';

function makeActor(world, name, eq, hp = 10) {
  const id = world.create();
  world.add(id, NamedIdentity, { name, identity: name.toLowerCase() });
  world.add(id, Vitality, { maxHp: Math.max(1, hp), hp });
  world.add(id, Equipment, {});
  const e = /** @type {any} */ (world.get(id, Equipment));
  if (eq?.weapon) e.weapon = eq.weapon;
  if (eq?.armor) e.armor = eq.armor;
  return id;
}

function makeWeapon(world, { id, name, attack }) {
  const wid = world.create();
  world.add(wid, NamedIdentity, { name, identity: id });
  world.add(wid, ItemInfo, { type: 'equip', slot: 'weapon', weight: 1, value: 0, description: '', count: 1, bonuses: { attack }, rarity: 1, rarityName: 'common', affixes: [] });
  return wid;
}

Deno.test("dead entity is destroyed by cleanup system", () => {
  const world = new World({ seed: 42 });

  const bigSword = makeWeapon(world, { id: 'test_big_sword', name: 'Test Sword', attack: 99 });
  const hero = makeActor(world, 'Hero', { weapon: bigSword }, 10);
  const foe = makeActor(world, 'Dummy', {}, 3);

  world.add(hero, Position, { x: 0, y: 0 });
  world.add(foe, Position, { x: 1, y: 0 });

  equipmentSystem(world);

  world.add(hero, AttackIntent, { targetId: foe });
  combatSystem(world);

  const fVit = /** @type {any} */ (world.get(foe, Vitality));
  assert(fVit && fVit.hp <= 0, 'foe should be at 0 hp or below');

  cleanupSystem(world);
  assert(!world.isAlive(foe), 'dead entity should be destroyed by cleanupSystem');

  // Idempotent
  cleanupSystem(world);
});

Deno.test("burning dead creatures leave ashes and no corpse", () => {
  const world = new World({ seed: 7 });
  const pet = world.create();
  world.add(pet, NamedIdentity, { name: 'Kitty', identity: 'kitty' });
  world.add(pet, Position, { x: 3, y: 4 });
  world.add(pet, Vitality, { maxHp: 10, hp: 0 });
  world.add(pet, Pet);
  world.add(pet, Owner, { ownerId: 123 });
  world.add(pet, ActiveEffects, { effects: [{ key: 'burning', turnsLeft: 2, potency: 1 }] });

  cleanupSystem(world);

  assert(!world.isAlive(pet), 'dead pet should be destroyed');
  const identities = [];
  for (const [, ni] of world.query(NamedIdentity)) {
    identities.push(String(ni?.identity || ''));
  }
  assert(identities.includes('ashes'), 'burning death should drop ashes');
  assert(!identities.some((id) => id.startsWith('corpse_')), 'burning death should not drop a corpse');
});

Deno.test("non-burning dead pets still drop corpses", () => {
  const world = new World({ seed: 8 });
  const pet = world.create();
  world.add(pet, NamedIdentity, { name: 'Kitty', identity: 'kitty' });
  world.add(pet, Position, { x: 3, y: 4 });
  world.add(pet, Vitality, { maxHp: 10, hp: 0 });
  world.add(pet, Pet);
  world.add(pet, Owner, { ownerId: 123 });

  cleanupSystem(world);

  const identities = [];
  for (const [, ni] of world.query(NamedIdentity)) {
    identities.push(String(ni?.identity || ''));
  }
  assert(identities.includes('corpse_kitty'), 'non-burning pet death should still drop corpse');
});

Deno.test("monster death drops all items on the death tile", () => {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);

  const world = new World({ seed: 31337 });
  const monster = world.create();
  world.add(monster, NamedIdentity, { name: "Goblin", identity: "goblin" });
  world.add(monster, Position, { x: 3, y: 3 });
  world.add(monster, Vitality, { maxHp: 10, hp: 0 });
  world.add(monster, Inventory, { capacity: 8 });

  const item = world.create();
  world.add(item, NamedIdentity, { name: "Rusty Dagger", identity: "test_rusty_dagger" });
  world.add(item, ItemInfo, {
    type: "equip",
    slot: "weapon",
    weight: 1,
    value: 1,
    description: "",
    count: 1,
    bonuses: {},
    rarity: 1,
    rarityName: "common",
    affixes: [],
  });
  addToInventory(world, monster, item);

  cleanupSystem(world);

  const droppedPos = world.get(item, Position);
  assert(droppedPos, "monster item should be dropped to ground");
  assertEquals(droppedPos.x | 0, 3, "item should drop at death x");
  assertEquals(droppedPos.y | 0, 3, "item should drop at death y");
});

Deno.test("death loot impulse uses same-turn positive-impact only", () => {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);

  const world = new World({ seed: 4242 });
  const monster = world.create();
  world.add(monster, NamedIdentity, { name: "Goblin", identity: "goblin" });
  world.add(monster, Position, { x: 8, y: 8 });
  world.add(monster, Vitality, { maxHp: 10, hp: 2 });
  world.add(monster, Inventory, { capacity: 4 });

  const item = world.create();
  world.add(item, NamedIdentity, { name: "Test Ring", identity: "test_ring" });
  world.add(item, ItemInfo, {
    type: "equip",
    slot: "ring",
    weight: 1,
    value: 1,
    description: "",
    count: 1,
    bonuses: {},
    rarity: 1,
    rarityName: "common",
    affixes: [],
  });
  addToInventory(world, monster, item);

  const drops = [];
  world.on("item:dropped", (evt) => drops.push(evt));

  // Non-damaging hit must not seed death impulse.
  world.emit("damaged", {
    target: monster,
    amount: 0,
    rawAmount: 0,
    impactVector: { dx: 1, dy: 0 },
    critical: false,
  });
  // Advance turn so any prior impact data is stale by cleanup time.
  world.step = (world.step | 0) + 1;
  // Lethal without an impact payload this turn should produce no impulse.
  const vit = world.get(monster, Vitality);
  vit.hp = 0;
  cleanupSystem(world);

  const dropEvt = drops.find((evt) => Number(evt?.itemId || 0) === item);
  assert(dropEvt, "expected dropped item event for dead monster inventory item");
  assert(!dropEvt.impulse, "stale/non-damaging impacts should not drive loot impulse");
});
