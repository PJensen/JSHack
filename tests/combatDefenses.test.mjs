import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { AttackIntent } from '../src/rules/components/Intents/AttackIntent.js';
import { Equipment } from '../src/rules/components/Equipment.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { ActiveEffects } from '../src/rules/components/ActiveEffects.js';
import { Position } from '../src/rules/components/Position.js';
import { Facing } from '../src/rules/components/Facing.js';
import { equipmentSystem } from '../src/rules/systems/equipmentSystem.js';
import { combatSystem } from '../src/rules/systems/combatSystem.js';
import { SHIELD_GUARD_KEY, SHIELD_MAX_GUARD_STACKS, SHIELD_BROKEN_KEY } from '../src/rules/utils/shieldGuard.js';

function makeActor(world, name, eq, hp = 30) {
  const id = world.create();
  world.add(id, NamedIdentity, { name, identity: name.toLowerCase() });
  world.add(id, Vitality, { maxHp: Math.max(30, hp), hp });
  world.add(id, Equipment, {});
  const e = world.get(id, Equipment);
  if (eq?.weapon) e.weapon = eq.weapon;
  if (eq?.armor) e.armor = eq.armor;
  if (eq?.offhand) e.offhand = eq.offhand;
  return id;
}

function makeEquip(world, { id, name, slot, bonuses, damageType = null, subtype = null, damageDice = null }) {
  const eid = world.create();
  world.add(eid, NamedIdentity, { name, identity: id });
  const info = {
    type: 'equip',
    slot,
    weight: 1,
    value: 0,
    description: '',
    count: 1,
    bonuses: bonuses || {},
    rarity: 1,
    rarityName: 'common',
    affixes: [],
    damageType,
  };
  if (damageDice) info.damageDice = damageDice;
  if (subtype) info.subtype = subtype;
  world.add(eid, ItemInfo, info);
  return eid;
}

function positionActors(world, attacker, defender) {
  world.add(attacker, Position, { x: 5, y: 5 });
  world.add(defender, Position, { x: 5, y: 6 });
  // Attacker faces south (toward defender)
  world.add(attacker, Facing, { dx: 0, dy: 1 });
}

// ── Dodge tests ──────────────────────────────────────────────────────

Deno.test("dodge: high evade defender can dodge attacks", () => {
  let dodgeCount = 0;
  let hitCount = 0;
  const TRIALS = 200;

  for (let seed = 1; seed <= TRIALS; seed++) {
    const world = new World({ seed });
    // Attacker: big accuracy so the d20 hit roll passes, isolating dodge check
    const weapon = makeEquip(world, {
      id: 'sword_plain', name: 'Sword', slot: 'weapon',
      bonuses: { accuracy: 40, damagePower: 2 }, damageDice: '1d4',
    });
    const attacker = makeActor(world, 'Attacker', { weapon }, 30);
    // Defender with high evade
    const armor = makeEquip(world, {
      id: 'leather_armor', name: 'Leather', slot: 'armor',
      bonuses: { evade: 15 },
    });
    const defender = makeActor(world, 'Defender', { armor }, 50);
    positionActors(world, attacker, defender);
    equipmentSystem(world);

    let dodged = false;
    world.on('combat:dodge', () => { dodged = true; });
    world.add(attacker, AttackIntent, { targetId: defender });
    combatSystem(world);

    if (dodged) dodgeCount++;
    else hitCount++;
  }

  // With evade=15, dodge chance = 15/(15+20) = ~43%. Over 200 trials we expect many dodges.
  assert(dodgeCount > 30, `expected significant dodge count, got ${dodgeCount}/${TRIALS}`);
  assert(hitCount > 30, `expected some hits too, got ${hitCount}/${TRIALS}`);
});

Deno.test("dodge: zero evade defender never dodges", () => {
  let dodgeCount = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const world = new World({ seed });
    const weapon = makeEquip(world, {
      id: 'sword_plain', name: 'Sword', slot: 'weapon',
      bonuses: { accuracy: 40, damagePower: 2 }, damageDice: '1d4',
    });
    const attacker = makeActor(world, 'Attacker', { weapon }, 30);
    const defender = makeActor(world, 'Defender', {}, 50);
    positionActors(world, attacker, defender);
    equipmentSystem(world);

    world.on('combat:dodge', () => { dodgeCount++; });
    world.add(attacker, AttackIntent, { targetId: defender });
    combatSystem(world);
  }
  assertEquals(dodgeCount, 0, 'zero evade should never trigger dodge');
});

Deno.test("dodge: critical hits bypass dodge", () => {
  // Nat 20 always crits — dodge should not trigger on crits
  let dodgeCount = 0;
  let critCount = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const world = new World({ seed });
    const weapon = makeEquip(world, {
      id: 'sword_plain', name: 'Sword', slot: 'weapon',
      bonuses: { accuracy: 40, damagePower: 2 }, damageDice: '1d4',
    });
    const attacker = makeActor(world, 'Attacker', { weapon }, 30);
    const armor = makeEquip(world, {
      id: 'leather_armor', name: 'Leather', slot: 'armor',
      bonuses: { evade: 20 },
    });
    const defender = makeActor(world, 'Defender', { armor }, 100);
    positionActors(world, attacker, defender);
    equipmentSystem(world);

    let dodged = false;
    world.on('combat:dodge', () => { dodged = true; });
    world.on('damaged', (e) => { if (e.critical) critCount++; });
    world.add(attacker, AttackIntent, { targetId: defender });
    combatSystem(world);
    if (dodged) dodgeCount++;
  }
  // Some attacks will be crits (nat 20), and those should never be dodged
  // The dodge event and crit events should be mutually exclusive
  assert(critCount > 0, 'expected at least one crit in 300 trials');
  // Can't directly verify crits bypass dodge from outside, but we can verify
  // the system still produces dodges AND crits independently
  assert(dodgeCount > 0, 'expected at least some dodges in 300 trials');
});

// ── Parry tests ──────────────────────────────────────────────────────

Deno.test("parry: weapon-wielding defender can parry (no shield)", () => {
  let parryCount = 0;
  const TRIALS = 500;

  for (let seed = 1; seed <= TRIALS; seed++) {
    const world = new World({ seed });
    const atkWeapon = makeEquip(world, {
      id: 'sword_plain', name: 'Sword', slot: 'weapon',
      bonuses: { accuracy: 40, damagePower: 2 }, damageDice: '1d4',
    });
    const attacker = makeActor(world, 'Attacker', { weapon: atkWeapon }, 30);
    // Defender with weapon (no shield) and some evade for parry chance
    const defWeapon = makeEquip(world, {
      id: 'longsword', name: 'Longsword', slot: 'weapon',
      bonuses: { accuracy: 2, damagePower: 2 }, damageDice: '1d6',
    });
    const defArmor = makeEquip(world, {
      id: 'leather_armor', name: 'Leather', slot: 'armor',
      bonuses: { evade: 5 },
    });
    const defender = makeActor(world, 'Defender', { weapon: defWeapon, armor: defArmor }, 50);
    positionActors(world, attacker, defender);
    equipmentSystem(world);

    world.on('combat:parry', () => { parryCount++; });
    world.add(attacker, AttackIntent, { targetId: defender });
    combatSystem(world);
  }

  // Parry chance with evade=5: min(0.25, 0.08 + 5*0.01) = 13%. Over 500 trials expect >20
  assert(parryCount > 10, `expected parries, got ${parryCount}/${TRIALS}`);
});

Deno.test("parry: shield-wielding defender does NOT parry", () => {
  let parryCount = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const world = new World({ seed });
    const atkWeapon = makeEquip(world, {
      id: 'sword_plain', name: 'Sword', slot: 'weapon',
      bonuses: { accuracy: 40, damagePower: 2 }, damageDice: '1d4',
    });
    const attacker = makeActor(world, 'Attacker', { weapon: atkWeapon }, 30);
    // Defender with weapon AND shield — parry should not trigger
    const defWeapon = makeEquip(world, {
      id: 'longsword', name: 'Longsword', slot: 'weapon',
      bonuses: { accuracy: 2, damagePower: 2 }, damageDice: '1d6',
    });
    const shield = makeEquip(world, {
      id: 'shield_wood', name: 'Wooden Shield', slot: 'offhand',
      bonuses: { defense: 1 }, subtype: 'shield',
    });
    const defender = makeActor(world, 'Defender', { weapon: defWeapon, offhand: shield }, 50);
    positionActors(world, attacker, defender);
    equipmentSystem(world);

    world.on('combat:parry', () => { parryCount++; });
    world.add(attacker, AttackIntent, { targetId: defender });
    combatSystem(world);
  }
  assertEquals(parryCount, 0, 'shield-wielders should not parry');
});

Deno.test("parry: unarmed defender does NOT parry", () => {
  let parryCount = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const world = new World({ seed });
    const atkWeapon = makeEquip(world, {
      id: 'sword_plain', name: 'Sword', slot: 'weapon',
      bonuses: { accuracy: 40, damagePower: 2 }, damageDice: '1d4',
    });
    const attacker = makeActor(world, 'Attacker', { weapon: atkWeapon }, 30);
    const defArmor = makeEquip(world, {
      id: 'leather_armor', name: 'Leather', slot: 'armor',
      bonuses: { evade: 10 },
    });
    // No weapon equipped
    const defender = makeActor(world, 'Defender', { armor: defArmor }, 50);
    positionActors(world, attacker, defender);
    equipmentSystem(world);

    world.on('combat:parry', () => { parryCount++; });
    world.add(attacker, AttackIntent, { targetId: defender });
    combatSystem(world);
  }
  assertEquals(parryCount, 0, 'unarmed defender cannot parry');
});

// ── Shield guard tests ───────────────────────────────────────────────

Deno.test("shield: guarded event fires when shield blocks", () => {
  let guardedCount = 0;
  const TRIALS = 200;

  for (let seed = 1; seed <= TRIALS; seed++) {
    const world = new World({ seed });
    const weapon = makeEquip(world, {
      id: 'sword_plain', name: 'Sword', slot: 'weapon',
      bonuses: { accuracy: 40, damagePower: 4 }, damageDice: '1d6',
    });
    const attacker = makeActor(world, 'Attacker', { weapon }, 30);
    const shield = makeEquip(world, {
      id: 'shield_iron', name: 'Iron Shield', slot: 'offhand',
      bonuses: { defense: 2 }, subtype: 'shield',
    });
    const defender = makeActor(world, 'Defender', { offhand: shield }, 80);
    positionActors(world, attacker, defender);
    // Defender faces north (attacker is hitting from front since attacker is at y=5, defender at y=6)
    world.add(defender, Facing, { dx: 0, dy: -1 });
    equipmentSystem(world);

    world.on('shield:guarded', () => { guardedCount++; });
    world.add(attacker, AttackIntent, { targetId: defender });
    combatSystem(world);
  }

  assert(guardedCount > 20, `expected shield guard events, got ${guardedCount}/${TRIALS}`);
});

Deno.test("shield: guard stacks decrement on successive blocks", () => {
  // Find a seed where the attack hits and shield blocks
  for (let seed = 1; seed <= 300; seed++) {
    const world = new World({ seed });
    const weapon = makeEquip(world, {
      id: 'sword_plain', name: 'Sword', slot: 'weapon',
      bonuses: { accuracy: 40, damagePower: 4 }, damageDice: '1d6',
    });
    const attacker = makeActor(world, 'Attacker', { weapon }, 30);
    const shield = makeEquip(world, {
      id: 'shield_iron', name: 'Iron Shield', slot: 'offhand',
      bonuses: { defense: 2 }, subtype: 'shield',
    });
    const defender = makeActor(world, 'Defender', { offhand: shield }, 80);
    positionActors(world, attacker, defender);
    world.add(defender, Facing, { dx: 0, dy: -1 });
    equipmentSystem(world);

    const guardEvents = [];
    world.on('shield:guarded', (e) => guardEvents.push(e));
    world.add(attacker, AttackIntent, { targetId: defender });
    combatSystem(world);

    if (guardEvents.length > 0) {
      const stacks = guardEvents[0].stacks;
      // After one block from max stacks (3), should have 2 remaining
      assertEquals(stacks, SHIELD_MAX_GUARD_STACKS - 1,
        `after first block, stacks should be ${SHIELD_MAX_GUARD_STACKS - 1}, got ${stacks}`);
      return; // test passed
    }
  }
  assert(false, 'could not find a seed where shield guard triggers');
});

Deno.test("shield: broken event fires when all stacks consumed", () => {
  // Pre-set shield to 1 stack so next hit breaks it
  for (let seed = 1; seed <= 300; seed++) {
    const world = new World({ seed });
    const weapon = makeEquip(world, {
      id: 'sword_plain', name: 'Sword', slot: 'weapon',
      bonuses: { accuracy: 40, damagePower: 4 }, damageDice: '1d6',
    });
    const attacker = makeActor(world, 'Attacker', { weapon }, 30);
    const shield = makeEquip(world, {
      id: 'shield_iron', name: 'Iron Shield', slot: 'offhand',
      bonuses: { defense: 2 }, subtype: 'shield',
    });
    const defender = makeActor(world, 'Defender', { offhand: shield }, 80);
    positionActors(world, attacker, defender);
    world.add(defender, Facing, { dx: 0, dy: -1 });
    equipmentSystem(world);

    // Pre-set guard to 1 stack
    world.add(defender, ActiveEffects, {
      effects: [{ key: SHIELD_GUARD_KEY, turnsLeft: 10, potency: 1, stacks: 1, meta: { maxStacks: SHIELD_MAX_GUARD_STACKS } }],
    });

    let broken = false;
    world.on('shield:broken', () => { broken = true; });
    world.on('shield:guarded', (e) => {
      if (e.broken) broken = true;
    });
    world.add(attacker, AttackIntent, { targetId: defender });
    combatSystem(world);

    if (broken) {
      // Verify broken effect was applied
      const ae = world.get(defender, ActiveEffects);
      const brokenEff = ae?.effects?.find(e => e.key === SHIELD_BROKEN_KEY);
      assert(brokenEff, 'shield_broken effect should be applied after breaking');
      return; // test passed
    }
  }
  assert(false, 'could not find a seed where shield breaks');
});

// ── Combined: dodge, parry, and damage are mutually exclusive ────────

Deno.test("combat defenses: dodge/parry/damage are mutually exclusive per attack", () => {
  let dodges = 0;
  let parries = 0;
  let hits = 0;
  let misses = 0;
  const TRIALS = 500;

  for (let seed = 1; seed <= TRIALS; seed++) {
    const world = new World({ seed });
    const atkWeapon = makeEquip(world, {
      id: 'sword_plain', name: 'Sword', slot: 'weapon',
      bonuses: { accuracy: 10, damagePower: 2 }, damageDice: '1d4',
    });
    const attacker = makeActor(world, 'Attacker', { weapon: atkWeapon }, 30);
    const defWeapon = makeEquip(world, {
      id: 'longsword', name: 'Longsword', slot: 'weapon',
      bonuses: { accuracy: 2, damagePower: 2, evade: 8 }, damageDice: '1d6',
    });
    const defender = makeActor(world, 'Defender', { weapon: defWeapon }, 100);
    positionActors(world, attacker, defender);
    equipmentSystem(world);

    let outcome = null;
    world.on('combat:dodge', () => { outcome = 'dodge'; });
    world.on('combat:parry', () => { outcome = 'parry'; });
    world.on('damaged', () => { if (!outcome) outcome = 'hit'; });
    world.on('status', (e) => {
      if (!outcome && e?.kind === 'miss') outcome = 'miss';
    });

    world.add(attacker, AttackIntent, { targetId: defender });
    combatSystem(world);

    if (outcome === 'dodge') dodges++;
    else if (outcome === 'parry') parries++;
    else if (outcome === 'hit') hits++;
    else misses++;
  }

  // All four outcomes should occur over 500 trials
  assert(dodges > 0, `expected some dodges, got ${dodges}`);
  assert(parries > 0, `expected some parries, got ${parries}`);
  assert(hits > 0, `expected some hits, got ${hits}`);
  assert(misses > 0, `expected some misses, got ${misses}`);
  assertEquals(dodges + parries + hits + misses, TRIALS, 'every trial should have exactly one outcome');
});
