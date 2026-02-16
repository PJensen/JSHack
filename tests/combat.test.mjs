import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { AttackIntent } from '../src/rules/components/Intents/AttackIntent.js';
import { Equipment } from '../src/rules/components/Equipment.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { Resistances } from '../src/rules/components/Resistences.js';
import { equipmentSystem } from '../src/rules/systems/equipmentSystem.js';
import { combatSystem } from '../src/rules/systems/combatSystem.js';
import { installAffixTriggers } from '../src/rules/systems/affixTriggerSystem.js';
import { Position } from '../src/rules/components/Position.js';

function makeActor(world, name, eq, hp = 10, resistances = null) {
  const id = world.create();
  world.add(id, NamedIdentity, { name, identity: name.toLowerCase() });
  world.add(id, Vitality, { maxHp: 10, hp });
  world.add(id, Equipment, {});
  if (resistances) world.add(id, Resistances, resistances);
  const e = world.get(id, Equipment);
  if (eq?.weapon) e.weapon = eq.weapon;
  if (eq?.armor) e.armor = eq.armor;
  if (eq?.shield) e.shield = eq.shield;
  if (eq?.ring1) e.ring1 = eq.ring1;
  if (eq?.ring2) e.ring2 = eq.ring2;
  return id;
}

function makeEquip(world, { id, name, slot, bonuses, affixes = [] }) {
  const eid = world.create();
  world.add(eid, NamedIdentity, { name, identity: id });
  world.add(eid, ItemInfo, { type: 'equip', slot, weight: 1, value: 0, description: '', count: 1, bonuses: bonuses || {}, rarity: 1, rarityName: 'common', affixes });
  return eid;
}

Deno.test("d20 combat with affix triggers: fierce, vamp, thorns", () => {
  const world = new World({ seed: 123 });
  installAffixTriggers(world);

  const sword = makeEquip(world, { id: 'sword_plain', name: 'Sword', slot: 'weapon', bonuses: { attack: 2 }, affixes: ['fierce', 'vamp1'] });
  const thorns = makeEquip(world, { id: 'leather_armor', name: 'Leather', slot: 'armor', bonuses: { defense: 1 }, affixes: ['thorns1'] });

  const hero = makeActor(world, 'Hero', { weapon: sword }, 9);
  const foe = makeActor(world, 'Goblin', { armor: thorns });

  world.add(hero, Position, { x: 1, y: 1 });
  world.add(foe, Position, { x: 1, y: 2 });

  equipmentSystem(world);

  world.add(hero, AttackIntent, { targetId: foe });
  combatSystem(world);

  const hVit = world.get(hero, Vitality);
  const fVit = world.get(foe, Vitality);

  assert(fVit.hp === 5, `foe should be at 5 hp, got ${fVit.hp}`);
  assert(hVit.hp === 8, `hero HP after vamp + thorns should be 8, got ${hVit.hp}`);
});

Deno.test("caustic affix adds acid chip that is blocked by acid immunity", () => {
  const worldA = new World({ seed: 202 });
  installAffixTriggers(worldA);
  const weaponA = makeEquip(worldA, { id: 'test_caustic', name: 'Caustic Blade', slot: 'weapon', bonuses: { attack: 6 }, affixes: ['caustic1'] });
  const heroA = makeActor(worldA, 'Hero', { weapon: weaponA }, 10);
  const foeA = makeActor(worldA, 'Target', {}, 10, { chemical: { acidMult: 1.0 } });
  worldA.add(heroA, Position, { x: 1, y: 1 });
  worldA.add(foeA, Position, { x: 1, y: 2 });
  equipmentSystem(worldA);
  worldA.add(heroA, AttackIntent, { targetId: foeA });
  combatSystem(worldA);
  const hpNormal = worldA.get(foeA, Vitality).hp;

  const worldB = new World({ seed: 202 });
  installAffixTriggers(worldB);
  const weaponB = makeEquip(worldB, { id: 'test_caustic', name: 'Caustic Blade', slot: 'weapon', bonuses: { attack: 6 }, affixes: ['caustic1'] });
  const heroB = makeActor(worldB, 'Hero', { weapon: weaponB }, 10);
  const foeB = makeActor(worldB, 'Target', {}, 10, { chemical: { acidMult: 0.0 } });
  worldB.add(heroB, Position, { x: 1, y: 1 });
  worldB.add(foeB, Position, { x: 1, y: 2 });
  equipmentSystem(worldB);
  worldB.add(heroB, AttackIntent, { targetId: foeB });
  combatSystem(worldB);
  const hpImmune = worldB.get(foeB, Vitality).hp;

  assert(hpImmune === hpNormal + 1, `acid-immune target should block caustic chip (normal=${hpNormal}, immune=${hpImmune})`);
});

Deno.test("insulated affix mitigates capacitive electric chip", () => {
  const worldA = new World({ seed: 202 });
  installAffixTriggers(worldA);
  const weaponA = makeEquip(worldA, { id: 'test_cap', name: 'Capacitive Blade', slot: 'weapon', bonuses: { attack: 6 }, affixes: ['capacitive1'] });
  const heroA = makeActor(worldA, 'Hero', { weapon: weaponA }, 10);
  const foeA = makeActor(worldA, 'Target', {}, 10, { electric: { ohms: 1000, fibrillationA: 0.03 } });
  worldA.add(heroA, Position, { x: 1, y: 1 });
  worldA.add(foeA, Position, { x: 1, y: 2 });
  equipmentSystem(worldA);
  worldA.add(heroA, AttackIntent, { targetId: foeA });
  combatSystem(worldA);
  const hpPlain = worldA.get(foeA, Vitality).hp;

  const worldB = new World({ seed: 202 });
  installAffixTriggers(worldB);
  const weaponB = makeEquip(worldB, { id: 'test_cap', name: 'Capacitive Blade', slot: 'weapon', bonuses: { attack: 6 }, affixes: ['capacitive1'] });
  const insulatedShield = makeEquip(worldB, { id: 'test_insulated', name: 'Insulated Shield', slot: 'shield', bonuses: {}, affixes: ['insulated1'] });
  const heroB = makeActor(worldB, 'Hero', { weapon: weaponB }, 10);
  const foeB = makeActor(worldB, 'Target', { shield: insulatedShield }, 10, { electric: { ohms: 1000, fibrillationA: 0.03 } });
  worldB.add(heroB, Position, { x: 1, y: 1 });
  worldB.add(foeB, Position, { x: 1, y: 2 });
  equipmentSystem(worldB);
  worldB.add(heroB, AttackIntent, { targetId: foeB });
  combatSystem(worldB);
  const hpInsulated = worldB.get(foeB, Vitality).hp;

  assert(hpInsulated === hpPlain + 1, `insulated should absorb 1-point electric chip (plain=${hpPlain}, insulated=${hpInsulated})`);
});
