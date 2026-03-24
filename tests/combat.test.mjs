import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { AttackIntent } from '../src/rules/components/Intents/AttackIntent.js';
import { Equipment } from '../src/rules/components/Equipment.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { Resistances } from '../src/rules/components/Resistences.js';
import { ActiveEffects } from '../src/rules/components/ActiveEffects.js';
import { Faction } from '../src/rules/components/Faction.js';
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
  if (eq?.offhand) e.offhand = eq.offhand;
  if (eq?.ring1) e.ring1 = eq.ring1;
  if (eq?.ring2) e.ring2 = eq.ring2;
  return id;
}

function makeEquip(world, { id, name, slot, bonuses, affixes = [], damageType = null }) {
  const eid = world.create();
  world.add(eid, NamedIdentity, { name, identity: id });
  world.add(eid, ItemInfo, {
    type: 'equip',
    slot,
    weight: 1,
    value: 0,
    description: '',
    count: 1,
    bonuses: bonuses || {},
    rarity: 1,
    rarityName: 'common',
    affixes,
    damageType,
  });
  return eid;
}

Deno.test("d20 combat with affix triggers: fierce, vamp, thorns", () => {
  const world = new World({ seed: 123 });
  installAffixTriggers(world);

  const sword = makeEquip(world, { id: 'sword_plain', name: 'Sword', slot: 'weapon', bonuses: { accuracy: 2, damagePower: 2 }, affixes: ['fierce', 'vamp1'] });
  const thorns = makeEquip(world, { id: 'leather_armor', name: 'Leather', slot: 'armor', bonuses: { evade: 1 }, affixes: ['thorns1'] });

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

Deno.test("blunt melee deals extra damage to skeleton-style resistance profile", () => {
  const baseResist = { kinetic: { DR: 4, bluntMult: 1.0, slashMult: 0.7, pierceMult: 0.5 } };
  const skeletalResist = { kinetic: { DR: 4, bluntMult: 1.5, slashMult: 0.7, pierceMult: 0.5 } };

  function runOne(seed, resistances) {
    const world = new World({ seed });
    installAffixTriggers(world);
    const mace = makeEquip(world, {
      id: 'test_blunt_mace',
      name: 'Test Mace',
      slot: 'weapon',
      bonuses: { accuracy: 12, damagePower: 12 },
      damageType: 'blunt',
    });
    const hero = makeActor(world, 'Hero', { weapon: mace }, 30);
    const foe = makeActor(world, 'Target', {}, 30, resistances);
    world.add(hero, Position, { x: 1, y: 1 });
    world.add(foe, Position, { x: 1, y: 2 });
    equipmentSystem(world);
    world.add(hero, AttackIntent, { targetId: foe });
    combatSystem(world);
    return 30 - world.get(foe, Vitality).hp;
  }

  let compared = false;
  for (let seed = 1; seed <= 64; seed++) {
    const dmgBase = runOne(seed, baseResist);
    const dmgSkeletal = runOne(seed, skeletalResist);
    if (dmgBase === 0 && dmgSkeletal === 0) continue; // same nat1 miss path
    assert(dmgSkeletal > dmgBase, `expected skeletal profile to take more blunt damage (base=${dmgBase}, skeletal=${dmgSkeletal}, seed=${seed})`);
    compared = true;
    break;
  }
  assert(compared, 'expected at least one deterministic seed with a landed hit');
});

Deno.test("pierce melee penetration improves damage into heavy armor", () => {
  const heavyResist = { kinetic: { DR: 6, bluntMult: 1.0, slashMult: 1.0, pierceMult: 1.0 } };

  function runOne(seed, bonuses) {
    const world = new World({ seed });
    installAffixTriggers(world);
    const weapon = makeEquip(world, {
      id: 'test_pierce_weapon',
      name: 'Test Piercer',
      slot: 'weapon',
      bonuses,
      damageType: 'pierce',
    });
    const hero = makeActor(world, 'Hero', { weapon }, 30);
    const foe = makeActor(world, 'Target', {}, 30, heavyResist);
    world.add(hero, Position, { x: 1, y: 1 });
    world.add(foe, Position, { x: 1, y: 2 });
    equipmentSystem(world);
    world.add(hero, AttackIntent, { targetId: foe });
    combatSystem(world);
    return 30 - world.get(foe, Vitality).hp;
  }

  let compared = false;
  for (let seed = 1; seed <= 64; seed++) {
    const base = runOne(seed, { accuracy: 12, damagePower: 6 });
    const piercing = runOne(seed, { accuracy: 12, damagePower: 6, piercePenetration: 3 });
    if (base === 0 && piercing === 0) continue;
    assert(piercing > base, `expected pierce penetration to improve heavy-armor damage (base=${base}, piercing=${piercing}, seed=${seed})`);
    compared = true;
    break;
  }
  assert(compared, 'expected at least one deterministic seed with a landed hit');
});

Deno.test("caustic affix adds acid chip that is blocked by acid immunity", () => {
  const worldA = new World({ seed: 202 });
  installAffixTriggers(worldA);
  const weaponA = makeEquip(worldA, { id: 'test_caustic', name: 'Caustic Blade', slot: 'weapon', bonuses: { accuracy: 6, damagePower: 6 }, affixes: ['caustic1'] });
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
  const weaponB = makeEquip(worldB, { id: 'test_caustic', name: 'Caustic Blade', slot: 'weapon', bonuses: { accuracy: 6, damagePower: 6 }, affixes: ['caustic1'] });
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
  const weaponA = makeEquip(worldA, { id: 'test_cap', name: 'Capacitive Blade', slot: 'weapon', bonuses: { accuracy: 6, damagePower: 6 }, affixes: ['capacitive1'] });
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
  const weaponB = makeEquip(worldB, { id: 'test_cap', name: 'Capacitive Blade', slot: 'weapon', bonuses: { accuracy: 6, damagePower: 6 }, affixes: ['capacitive1'] });
  const insulatedShield = makeEquip(worldB, { id: 'test_insulated', name: 'Insulated Shield', slot: 'offhand', bonuses: {}, affixes: ['insulated1'] });
  const heroB = makeActor(worldB, 'Hero', { weapon: weaponB }, 10);
  const foeB = makeActor(worldB, 'Target', { offhand: insulatedShield }, 10, { electric: { ohms: 1000, fibrillationA: 0.03 } });
  worldB.add(heroB, Position, { x: 1, y: 1 });
  worldB.add(foeB, Position, { x: 1, y: 2 });
  equipmentSystem(worldB);
  worldB.add(heroB, AttackIntent, { targetId: foeB });
  combatSystem(worldB);
  const hpInsulated = worldB.get(foeB, Vitality).hp;

  assert(hpInsulated === hpPlain + 1, `insulated should absorb 1-point electric chip (plain=${hpPlain}, insulated=${hpInsulated})`);
});

Deno.test("poison weapon coating procs DOT at 25% and consumes one charge on proc", () => {
  function runOne(seed) {
    const world = new World({ seed });
    installAffixTriggers(world);

    const weapon = makeEquip(world, {
      id: 'test_poison_coated_blade',
      name: 'Poison Coated Blade',
      slot: 'weapon',
      bonuses: { attack: 12 },
      affixes: [],
    });

    const weaponInfo = world.get(weapon, ItemInfo);
    weaponInfo.coating = { kind: 'poison', charges: 3 };

    const attacker = makeActor(world, 'Hero', { weapon }, 20);
    const defender = makeActor(world, 'Target Dummy', {}, 50);
    world.add(attacker, Faction, { key: 'player' });
    world.add(defender, Faction, { key: 'enemy' });
    world.add(attacker, Position, { x: 2, y: 2 });
    world.add(defender, Position, { x: 2, y: 3 });

    equipmentSystem(world);
    world.add(attacker, AttackIntent, { targetId: defender });
    combatSystem(world);

    const updatedInfo = world.get(weapon, ItemInfo);
    const chargesAfter = Math.max(0, Number(updatedInfo?.coating?.charges || 0) | 0);
    const ae = world.get(defender, ActiveEffects);
    const poison = ae?.effects?.find((e) => e.key === 'poison');
    return {
      procced: Boolean(poison),
      chargesAfter,
      turnsLeft: Number(poison?.turnsLeft || 0),
      potency: Number(poison?.potency || 0),
    };
  }

  let foundProc = false;
  let foundNoProc = false;
  for (let seed = 1; seed <= 256; seed++) {
    const r = runOne(seed);
    if (r.procced) {
      foundProc = true;
      assertEquals(r.chargesAfter, 2, 'proc should consume exactly one coating charge');
      assertEquals(r.turnsLeft, 4, 'proc should apply poison for 4 turns');
      assertEquals(r.potency, 2, 'proc should apply poison potency 2');
    } else {
      foundNoProc = true;
      assertEquals(r.chargesAfter, 3, 'non-proc should not consume coating charge');
    }
    if (foundProc && foundNoProc) break;
  }

  assert(foundProc, 'expected at least one deterministic seed to trigger poison coating proc');
  assert(foundNoProc, 'expected at least one deterministic seed to not trigger poison coating proc');
});

Deno.test("blinded defenders are easier to hit in melee based on blindness strength", () => {
  function runOne(seed, blindPotency = 0) {
    const world = new World({ seed });
    installAffixTriggers(world);
    const weapon = makeEquip(world, {
      id: 'test_blind_melee_weapon',
      name: 'Blind Test Blade',
      slot: 'weapon',
      bonuses: { accuracy: 0, damagePower: 6 },
    });
    const attacker = makeActor(world, 'Attacker', { weapon }, 20);
    const defender = makeActor(world, 'Defender', { armor: makeEquip(world, {
      id: 'test_blind_melee_armor',
      name: 'Blind Test Armor',
      slot: 'armor',
      bonuses: { evade: 18 },
    }) }, 20);
    if (blindPotency > 0) {
      world.add(defender, ActiveEffects, {
        effects: [{ key: 'blinded', turnsLeft: 5, potency: blindPotency, stacks: 1 }],
      });
    }
    world.add(attacker, Position, { x: 1, y: 1 });
    world.add(defender, Position, { x: 1, y: 2 });
    equipmentSystem(world);
    world.add(attacker, AttackIntent, { targetId: defender });
    combatSystem(world);
    return 20 - world.get(defender, Vitality).hp;
  }

  let compared = false;
  let scaled = false;
  for (let seed = 1; seed <= 256; seed++) {
    const baseline = runOne(seed, 0);
    const blinded2 = runOne(seed, 2);
    const blinded = runOne(seed, 4);
    if (baseline === 0 && blinded > 0) {
      compared = true;
    }
    if (blinded2 === 0 && blinded > 0) scaled = true;
    if (compared && scaled) break;
  }
  assert(compared, "expected at least one deterministic seed where blinded defender takes a hit that baseline avoids");
  assert(scaled, "expected higher blindness potency to create a hit opportunity not present at lower blindness potency");
});

Deno.test("blinded defenders take more melee direct-hit physical damage", () => {
  function runOne(seed, blindPotency = 0) {
    const world = new World({ seed });
    installAffixTriggers(world);
    const weapon = makeEquip(world, {
      id: 'test_blind_melee_damage_weapon',
      name: 'Blind Damage Test Blade',
      slot: 'weapon',
      bonuses: { accuracy: 0, damagePower: 16 },
    });
    const attacker = makeActor(world, 'Attacker', { weapon }, 20);
    const defender = makeActor(world, 'Defender', { armor: makeEquip(world, {
      id: 'test_blind_melee_damage_armor',
      name: 'Blind Damage Test Armor',
      slot: 'armor',
      bonuses: { evade: 16 },
    }) }, 30);
    if (blindPotency > 0) {
      world.add(defender, ActiveEffects, {
        effects: [{ key: 'blinded', turnsLeft: 5, potency: blindPotency, stacks: 1 }],
      });
    }
    world.add(attacker, Position, { x: 1, y: 1 });
    world.add(defender, Position, { x: 1, y: 2 });
    equipmentSystem(world);
    world.add(attacker, AttackIntent, { targetId: defender });
    combatSystem(world);
    return 30 - world.get(defender, Vitality).hp;
  }

  let compared = false;
  for (let seed = 1; seed <= 256; seed++) {
    const baseline = runOne(seed, 0);
    const blinded = runOne(seed, 4);
    if (baseline === 0 && blinded > 0) {
      compared = true;
      break;
    }
  }
  assert(compared, "expected at least one deterministic seed where blinded defender takes direct-hit damage that baseline avoids");
});
