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

function assert(c,m){ if(!c) throw new Error('Assertion failed: '+m); }

function makeActor(world, name, eq, hp=10) {
  const id = world.create();
  world.add(id, NamedIdentity, { name, identity: name.toLowerCase() });
  world.add(id, Vitality, { maxHp: 10, hp });
  world.add(id, Equipment, {});
  const e = world.get(id, Equipment);
  if (eq?.weapon) e.weapon = eq.weapon;
  if (eq?.armor) e.armor = eq.armor;
  return id;
}

function makeEquip(world, { id, name, slot, bonuses, affixes=[] }) {
  const eid = world.create();
  world.add(eid, NamedIdentity, { name, identity: id });
  world.add(eid, ItemInfo, { type:'equip', slot, weight:1, value:0, description:'', count:1, bonuses: bonuses||{}, rarity:1, rarityName:'common', affixes });
  return eid;
}

async function run() {
  const world = new World({ seed: 123 });
  installAffixTriggers(world);

  // Build actors and gear
  const sword = makeEquip(world, { id:'sword_plain', name:'Sword', slot:'weapon', bonuses:{ attack:2 }, affixes:['fierce','vamp1'] });
  const thorns = makeEquip(world, { id:'leather_armor', name:'Leather', slot:'armor', bonuses:{ defense:1 }, affixes:['thorns1'] });

  const hero = makeActor(world, 'Hero', { weapon: sword }, 9);
  const foe  = makeActor(world, 'Goblin', { armor: thorns });

  // Place actors adjacent so the melee range gate passes
  world.add(hero, Position, { x: 1, y: 1 });
  world.add(foe, Position, { x: 1, y: 2 });

  // derive
  equipmentSystem(world);
  // debug derived
  console.log('DBG derived', {
    atk: world.get(hero, Equipment).attackDerived,
    def: world.get(foe, Equipment).defenseDerived
  });

  // Attack!
  world.add(hero, AttackIntent, { targetId: foe });
  combatSystem(world);

  const hVit = world.get(hero, Vitality);
  const fVit = world.get(foe, Vitality);
  console.log('DBG hp', { hero: hVit.hp, foe: fVit.hp });

  // d20-based combat (seed=123):
  // d20 + attackBonus(3) vs AC 11 → hit
  // damage = 1d8 roll + flatBonus(floor(2/2)=1) = base
  // fierce (onBeforeHit) +1
  // vamp1 heals attacker floor(finalDmg/3)
  // thorns1 20% proc → retaliate 2 to attacker
  // With this seed: foe takes 5, hero 9 + 1(vamp) - 2(thorns) = 8
  assert(fVit.hp === 5, `foe should be at 5 hp, got ${fVit.hp}`);
  assert(hVit.hp === 8, `hero HP after vamp + thorns should be 8, got ${hVit.hp}`);

  console.log('Combat tests PASS');
}

run().catch(e=>{ console.error(e); process.exitCode = 1; });
