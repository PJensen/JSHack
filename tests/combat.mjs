import { World } from '../src/lib/ecs-js/index.js';
import { AttackIntent } from '../src/rules/components/Intents/AttackIntent.js';
import { Equipment } from '../src/rules/components/Equipment.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { equipmentSystem } from '../src/rules/systems/equipmentSystem.js';
import { combatSystem } from '../src/rules/systems/combatSystem.js';
import { installAffixTriggers } from '../src/rules/systems/affixTriggerSystem.js';

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

  // Expectations:
  // base damage = 1 + attackDerived(2) = 3
  // fierce (onBeforeHit) +1 -> 4
  // defense 1 -> 3 dealt
  // vamp1 heals attacker by floor(damage/3) => +1
  // Thorns now has 20% proc chance on hit; hero HP can be 10 (no proc) or 8 (proc for 2)
  assert(fVit.hp === 7, 'foe took 3 damage');
  assert(hVit.hp === 10 || hVit.hp === 8, `hero HP after vamp + possible thorns should be 10 or 8, got ${hVit.hp}`);

  console.log('Combat tests PASS');
}

run().catch(e=>{ console.error(e); process.exitCode = 1; });
