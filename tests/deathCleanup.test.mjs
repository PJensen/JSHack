import { assert } from "jsr:@std/assert";
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
