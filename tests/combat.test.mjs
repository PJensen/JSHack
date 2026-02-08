import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { AttackIntent } from '../src/rules/components/Intents/AttackIntent.js';
import { Equipment } from '../src/rules/components/Equipment.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { equipmentSystem } from '../src/rules/systems/equipmentSystem.js';
import { combatSystem } from '../src/rules/systems/combatSystem.js';
import { installAffixTriggers } from '../src/rules/systems/affixTriggerSystem.js';
import { Position } from '../src/rules/components/Position.js';

function makeActor(world, name, eq, hp = 10) {
  const id = world.create();
  world.add(id, NamedIdentity, { name, identity: name.toLowerCase() });
  world.add(id, Vitality, { maxHp: 10, hp });
  world.add(id, Equipment, {});
  const e = world.get(id, Equipment);
  if (eq?.weapon) e.weapon = eq.weapon;
  if (eq?.armor) e.armor = eq.armor;
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
