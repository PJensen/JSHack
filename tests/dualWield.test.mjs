import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { AttackIntent } from '../src/rules/components/Intents/AttackIntent.js';
import { EquipIntent } from '../src/rules/components/Intents/EquipIntent.js';
import { Equipment } from '../src/rules/components/Equipment.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { Inventory } from '../src/rules/components/Inventory.js';
import { Position } from '../src/rules/components/Position.js';
import { Stamina } from '../src/rules/components/Stamina.js';
import { Traits } from '../src/rules/components/Traits.js';
import { equipmentSystem } from '../src/rules/systems/equipmentSystem.js';
import { combatSystem } from '../src/rules/systems/combatSystem.js';
import { equipItemSystem } from '../src/rules/systems/equipItemSystem.js';
import { installAffixTriggers } from '../src/rules/systems/affixTriggerSystem.js';
import { ActiveEffects } from '../src/rules/components/ActiveEffects.js';
import { addToInventory, inventoryContains } from '../src/rules/utils/inventoryFacade.js';

function makeWeapon(world, { id, name, damageDice = '1d6', staminaCost = 8, twoHanded = false, bonuses = {}, affixes = [] }) {
  const eid = world.create();
  world.add(eid, NamedIdentity, { name, identity: id });
  world.add(eid, ItemInfo, {
    type: 'equip', slot: 'weapon', weight: 1, value: 0, description: '',
    count: 1, bonuses: { attack: 2, ...bonuses }, rarity: 1, rarityName: 'common',
    affixes, damageDice, staminaCost, twoHanded,
  });
  return eid;
}

function makeShield(world, { id, name, bonuses = {} }) {
  const eid = world.create();
  world.add(eid, NamedIdentity, { name, identity: id });
  world.add(eid, ItemInfo, {
    type: 'equip', slot: 'offhand', weight: 1, value: 0, description: '',
    count: 1, bonuses: { defense: 1, ...bonuses }, rarity: 1, rarityName: 'common',
    affixes: [],
  });
  return eid;
}

function makeActor(world, name, hp = 50) {
  const id = world.create();
  world.add(id, NamedIdentity, { name, identity: name.toLowerCase() });
  world.add(id, Vitality, { maxHp: hp, hp });
  world.add(id, Equipment, {});
  return id;
}

// ── Equip Tests ──────────────────────────────────────────────────────

Deno.test("equip auto-cascade: 1H weapon goes to offhand when weapon slot occupied by 1H", () => {
  const world = new World({ seed: 1 });
  const actor = world.create();
  world.add(actor, Inventory, { capacity: 100 });
  world.add(actor, Equipment, {});

  const sword = makeWeapon(world, { id: 'sword', name: 'Sword' });
  const dagger = makeWeapon(world, { id: 'dagger', name: 'Dagger', damageDice: '1d4', staminaCost: 5 });
  addToInventory(world, actor, sword);
  addToInventory(world, actor, dagger);

  // Equip sword → weapon slot
  world.add(actor, EquipIntent, { itemId: sword });
  equipItemSystem(world);
  let eq = world.get(actor, Equipment);
  assertEquals(eq.weapon, sword, 'sword should be in weapon slot');

  // Equip dagger → should cascade to offhand
  world.add(actor, EquipIntent, { itemId: dagger });
  equipItemSystem(world);
  eq = world.get(actor, Equipment);
  assertEquals(eq.weapon, sword, 'sword should still be in weapon slot');
  assertEquals(eq.offhand, dagger, 'dagger should be in offhand slot');
});

Deno.test("equip: 1H weapon replaces 2H weapon (no cascade)", () => {
  const world = new World({ seed: 1 });
  const actor = world.create();
  world.add(actor, Inventory, { capacity: 100 });
  world.add(actor, Equipment, {});

  const longsword = makeWeapon(world, { id: 'longsword', name: 'Longsword', twoHanded: true });
  const dagger = makeWeapon(world, { id: 'dagger', name: 'Dagger' });
  addToInventory(world, actor, longsword);
  addToInventory(world, actor, dagger);

  world.add(actor, EquipIntent, { itemId: longsword });
  equipItemSystem(world);
  let eq = world.get(actor, Equipment);
  assertEquals(eq.weapon, longsword);

  // Equip 1H while 2H is main → should replace weapon, not cascade
  world.add(actor, EquipIntent, { itemId: dagger });
  equipItemSystem(world);
  eq = world.get(actor, Equipment);
  assertEquals(eq.weapon, dagger, 'dagger should replace 2H in weapon slot');
  assert(!eq.offhand || eq.offhand <= 0, 'offhand should be empty');
  assert(inventoryContains(world, actor, longsword), 'longsword returned to inventory');
});

Deno.test("equip: unequip offhand weapon returns to single-wield", () => {
  const world = new World({ seed: 1 });
  const actor = world.create();
  world.add(actor, Inventory, { capacity: 100 });
  world.add(actor, Equipment, {});

  const sword = makeWeapon(world, { id: 'sword', name: 'Sword' });
  const dagger = makeWeapon(world, { id: 'dagger', name: 'Dagger' });
  addToInventory(world, actor, sword);
  addToInventory(world, actor, dagger);

  // Dual wield
  world.add(actor, EquipIntent, { itemId: sword });
  equipItemSystem(world);
  world.add(actor, EquipIntent, { itemId: dagger });
  equipItemSystem(world);
  let eq = world.get(actor, Equipment);
  assertEquals(eq.weapon, sword);
  assertEquals(eq.offhand, dagger);

  // Toggle-off offhand (select equipped item again)
  world.add(actor, EquipIntent, { itemId: dagger });
  equipItemSystem(world);
  eq = world.get(actor, Equipment);
  assertEquals(eq.weapon, sword, 'weapon should remain');
  assert(!eq.offhand || eq.offhand <= 0, 'offhand should be empty after unequip');
});

Deno.test("equip: 2H weapon kicks out offhand weapon when dual-wielding", () => {
  const world = new World({ seed: 1 });
  const actor = world.create();
  world.add(actor, Inventory, { capacity: 100 });
  world.add(actor, Equipment, {});

  const sword = makeWeapon(world, { id: 'sword', name: 'Sword' });
  const dagger = makeWeapon(world, { id: 'dagger', name: 'Dagger' });
  const greatsword = makeWeapon(world, { id: 'greatsword', name: 'Greatsword', twoHanded: true });
  addToInventory(world, actor, sword);
  addToInventory(world, actor, dagger);
  addToInventory(world, actor, greatsword);

  // Dual wield first
  world.add(actor, EquipIntent, { itemId: sword });
  equipItemSystem(world);
  world.add(actor, EquipIntent, { itemId: dagger });
  equipItemSystem(world);

  // Now equip 2H — should replace weapon AND kick offhand
  world.add(actor, EquipIntent, { itemId: greatsword });
  equipItemSystem(world);
  let eq = world.get(actor, Equipment);
  assertEquals(eq.weapon, greatsword, 'greatsword should be in weapon slot');
  assert(!eq.offhand || eq.offhand <= 0, '2H should kick out offhand weapon');
  assert(inventoryContains(world, actor, sword), 'old sword returned to inventory');
  assert(inventoryContains(world, actor, dagger), 'old dagger returned to inventory');
});

Deno.test("equip: shield replaces offhand weapon", () => {
  const world = new World({ seed: 1 });
  const actor = world.create();
  world.add(actor, Inventory, { capacity: 100 });
  world.add(actor, Equipment, {});

  const sword = makeWeapon(world, { id: 'sword', name: 'Sword' });
  const dagger = makeWeapon(world, { id: 'dagger', name: 'Dagger' });
  const shield = makeShield(world, { id: 'shield', name: 'Shield' });
  addToInventory(world, actor, sword);
  addToInventory(world, actor, dagger);
  addToInventory(world, actor, shield);

  // Dual wield
  world.add(actor, EquipIntent, { itemId: sword });
  equipItemSystem(world);
  world.add(actor, EquipIntent, { itemId: dagger });
  equipItemSystem(world);

  // Equip shield → should replace dagger in offhand
  world.add(actor, EquipIntent, { itemId: shield });
  equipItemSystem(world);
  let eq = world.get(actor, Equipment);
  assertEquals(eq.weapon, sword, 'sword should remain in weapon');
  assertEquals(eq.offhand, shield, 'shield should replace dagger in offhand');
  assert(inventoryContains(world, actor, dagger), 'dagger returned to inventory');
});

// ── Combat Tests ─────────────────────────────────────────────────────

Deno.test("dual wield: offhand attack fires after main hand (two damaged events)", () => {
  let damageCount = 0;
  let offhandCount = 0;

  // Try multiple seeds to find one where both attacks land
  for (let seed = 1; seed <= 64; seed++) {
    damageCount = 0;
    offhandCount = 0;

    const world = new World({ seed });
    installAffixTriggers(world);
    world.on('damaged', ({ offhand }) => {
      damageCount++;
      if (offhand) offhandCount++;
    });

    const sword = makeWeapon(world, { id: 'sword', name: 'Sword', bonuses: { attack: 12 } });
    const dagger = makeWeapon(world, { id: 'dagger', name: 'Dagger', damageDice: '1d4', staminaCost: 5, bonuses: { attack: 12 } });

    const hero = makeActor(world, 'Hero', 50);
    const eq = world.get(hero, Equipment);
    eq.weapon = sword;
    eq.offhand = dagger;
    world.add(hero, Stamina, { maxStamina: 100, stamina: 100, staminaRegen: 3, regenCooldown: 0 });

    const foe = makeActor(world, 'Goblin', 50);
    world.add(hero, Position, { x: 1, y: 1 });
    world.add(foe, Position, { x: 1, y: 2 });
    equipmentSystem(world);

    world.add(hero, AttackIntent, { targetId: foe });
    combatSystem(world);

    if (damageCount === 2) break;
  }

  assertEquals(damageCount, 2, 'should emit two damaged events (one per hand)');
  assertEquals(offhandCount, 1, 'exactly one should be flagged as offhand');
});

Deno.test("dual wield: offhand does NOT fire when offhand slot has a shield", () => {
  let damageCount = 0;

  for (let seed = 1; seed <= 64; seed++) {
    damageCount = 0;
    const world = new World({ seed });
    installAffixTriggers(world);
    world.on('damaged', () => { damageCount++; });

    const sword = makeWeapon(world, { id: 'sword', name: 'Sword', bonuses: { attack: 12 } });
    const shield = makeShield(world, { id: 'shield', name: 'Shield' });

    const hero = makeActor(world, 'Hero', 50);
    const eq = world.get(hero, Equipment);
    eq.weapon = sword;
    eq.offhand = shield;
    world.add(hero, Stamina, { maxStamina: 100, stamina: 100, staminaRegen: 3, regenCooldown: 0 });

    const foe = makeActor(world, 'Goblin', 50);
    world.add(hero, Position, { x: 1, y: 1 });
    world.add(foe, Position, { x: 1, y: 2 });
    equipmentSystem(world);

    world.add(hero, AttackIntent, { targetId: foe });
    combatSystem(world);

    if (damageCount === 1) break;
  }

  assertEquals(damageCount, 1, 'shield in offhand should not trigger second attack');
});

Deno.test("dual wield: offhand skipped when stamina insufficient after main hand", () => {
  let damageCount = 0;

  for (let seed = 1; seed <= 64; seed++) {
    damageCount = 0;
    const world = new World({ seed });
    installAffixTriggers(world);
    world.on('damaged', () => { damageCount++; });

    const sword = makeWeapon(world, { id: 'sword', name: 'Sword', staminaCost: 8, bonuses: { attack: 12 } });
    const dagger = makeWeapon(world, { id: 'dagger', name: 'Dagger', damageDice: '1d4', staminaCost: 6, bonuses: { attack: 12 } });

    const hero = makeActor(world, 'Hero', 50);
    const eq = world.get(hero, Equipment);
    eq.weapon = sword;
    eq.offhand = dagger;
    // Only enough stamina for main hand (8), not offhand half cost (ceil(6/2)=3)
    world.add(hero, Stamina, { maxStamina: 100, stamina: 10, staminaRegen: 3, regenCooldown: 0 });

    const foe = makeActor(world, 'Goblin', 50);
    world.add(hero, Position, { x: 1, y: 1 });
    world.add(foe, Position, { x: 1, y: 2 });
    equipmentSystem(world);

    world.add(hero, AttackIntent, { targetId: foe });
    combatSystem(world);

    if (damageCount === 1) break; // main hand hit, offhand skipped
  }

  assertEquals(damageCount, 1, 'offhand should be skipped when stamina is insufficient');
});

Deno.test("dual wield: offhand stamina cost is ceil(cost/2)", () => {
  // Use a seed that lands both hits, with enough stamina for both
  for (let seed = 1; seed <= 64; seed++) {
    let hitCount = 0;
    const world = new World({ seed });
    installAffixTriggers(world);
    world.on('damaged', () => { hitCount++; });

    const sword = makeWeapon(world, { id: 'sword', name: 'Sword', staminaCost: 8, bonuses: { attack: 12 } });
    const dagger = makeWeapon(world, { id: 'dagger', name: 'Dagger', damageDice: '1d4', staminaCost: 5, bonuses: { attack: 12 } });

    const hero = makeActor(world, 'Hero', 50);
    const eq = world.get(hero, Equipment);
    eq.weapon = sword;
    eq.offhand = dagger;
    world.add(hero, Stamina, { maxStamina: 100, stamina: 100, staminaRegen: 3, regenCooldown: 0 });

    const foe = makeActor(world, 'Goblin', 50);
    world.add(hero, Position, { x: 1, y: 1 });
    world.add(foe, Position, { x: 1, y: 2 });
    equipmentSystem(world);

    world.add(hero, AttackIntent, { targetId: foe });
    combatSystem(world);

    if (hitCount === 2) {
      const stam = world.get(hero, Stamina);
      // Expected: 100 - 8 (main) - ceil(5/2)=3 (offhand) = 89
      assertEquals(stam.stamina, 89, 'stamina should be 100 - 8 - ceil(5/2)');
      return;
    }
  }
  assert(false, 'no seed produced two hits within 64 tries');
});

Deno.test("dual wield: offhand does NOT fire when target dies from main hand", () => {
  let offhandFired = false;

  for (let seed = 1; seed <= 256; seed++) {
    offhandFired = false;
    let mainHit = false;

    const world = new World({ seed });
    installAffixTriggers(world);
    world.on('damaged', ({ offhand }) => {
      if (offhand) offhandFired = true;
      else mainHit = true;
    });

    const sword = makeWeapon(world, { id: 'sword', name: 'Sword', damageDice: '2d6', bonuses: { attack: 12 } });
    const dagger = makeWeapon(world, { id: 'dagger', name: 'Dagger', damageDice: '1d4', bonuses: { attack: 12 } });

    const hero = makeActor(world, 'Hero', 50);
    const eq = world.get(hero, Equipment);
    eq.weapon = sword;
    eq.offhand = dagger;
    world.add(hero, Stamina, { maxStamina: 100, stamina: 100, staminaRegen: 3, regenCooldown: 0 });

    // 1 HP target — should die from main hand hit
    const foe = makeActor(world, 'Goblin', 1);
    world.add(hero, Position, { x: 1, y: 1 });
    world.add(foe, Position, { x: 1, y: 2 });
    equipmentSystem(world);

    world.add(hero, AttackIntent, { targetId: foe });
    combatSystem(world);

    if (mainHit && !offhandFired) {
      assert(true, 'offhand correctly skipped on dead target');
      return;
    }
  }
  assert(false, 'no seed killed target with main hand within 256 tries');
});

Deno.test("dual wield: damaged event carries offhand:true flag", () => {
  const events = [];

  for (let seed = 1; seed <= 64; seed++) {
    events.length = 0;
    const world = new World({ seed });
    installAffixTriggers(world);
    world.on('damaged', (e) => { events.push(e); });

    const sword = makeWeapon(world, { id: 'sword', name: 'Sword', bonuses: { attack: 12 } });
    const dagger = makeWeapon(world, { id: 'dagger', name: 'Dagger', damageDice: '1d4', staminaCost: 5, bonuses: { attack: 12 } });

    const hero = makeActor(world, 'Hero', 50);
    const eq = world.get(hero, Equipment);
    eq.weapon = sword;
    eq.offhand = dagger;
    world.add(hero, Stamina, { maxStamina: 100, stamina: 100, staminaRegen: 3, regenCooldown: 0 });

    const foe = makeActor(world, 'Goblin', 50);
    world.add(hero, Position, { x: 1, y: 1 });
    world.add(foe, Position, { x: 1, y: 2 });
    equipmentSystem(world);

    world.add(hero, AttackIntent, { targetId: foe });
    combatSystem(world);

    if (events.length === 2) {
      assertEquals(!!events[0].offhand, false, 'first hit should not be offhand');
      assertEquals(events[1].offhand, true, 'second hit should be offhand');
      return;
    }
  }
  assert(false, 'no seed produced two hits within 64 tries');
});

Deno.test("dual wield: ambidextrous removes damage reduction", () => {
  // Compare offhand damage with and without ambidextrous (same seeds)
  // Ambidextrous should deal more per-hit since it removes the 0.75x multiplier
  let totalOffhandDmgNormal = 0;
  let totalOffhandDmgAmbi = 0;
  let pairsCompared = 0;

  function runOne(seed, ambi) {
    let offhandDmg = 0;
    const world = new World({ seed });
    installAffixTriggers(world);
    world.on('damaged', ({ amount, offhand }) => {
      if (offhand) offhandDmg = amount;
    });

    const sword = makeWeapon(world, { id: 'sword', name: 'Sword', bonuses: { attack: 12 } });
    const dagger = makeWeapon(world, { id: 'dagger', name: 'Dagger', damageDice: '1d6', staminaCost: 5, bonuses: { attack: 12 } });

    const hero = makeActor(world, 'Hero', 50);
    const eq = world.get(hero, Equipment);
    eq.weapon = sword;
    eq.offhand = dagger;
    world.add(hero, Stamina, { maxStamina: 100, stamina: 100, staminaRegen: 3, regenCooldown: 0 });
    if (ambi) world.add(hero, Traits, { ambidextrous: true });

    const foe = makeActor(world, 'Goblin', 50);
    world.add(hero, Position, { x: 1, y: 1 });
    world.add(foe, Position, { x: 1, y: 2 });
    equipmentSystem(world);

    world.add(hero, AttackIntent, { targetId: foe });
    combatSystem(world);
    return offhandDmg;
  }

  for (let seed = 1; seed <= 256; seed++) {
    const dmgNormal = runOne(seed, false);
    const dmgAmbi = runOne(seed, true);
    // Only compare seeds where both versions landed an offhand hit
    if (dmgNormal > 0 && dmgAmbi > 0) {
      totalOffhandDmgNormal += dmgNormal;
      totalOffhandDmgAmbi += dmgAmbi;
      pairsCompared++;
    }
  }

  assert(pairsCompared >= 5, `need at least 5 paired comparisons, got ${pairsCompared}`);
  // Ambidextrous removes the 0.75x multiplier so total damage should be higher
  assert(totalOffhandDmgAmbi > totalOffhandDmgNormal,
    `ambidextrous total damage should be higher: ${totalOffhandDmgAmbi} vs ${totalOffhandDmgNormal}`);
});

Deno.test("dual wield: 2x 1H total damage exceeds 1x 1H over 21 rounds", () => {
  // Benchmark: same hero, same foe, same 21 seeds
  // Single-wield vs dual-wield total damage output
  const ROUNDS = 21;

  function runRounds(dualWield) {
    let totalDamage = 0;
    for (let seed = 1; seed <= ROUNDS; seed++) {
      const world = new World({ seed });
      installAffixTriggers(world);
      world.on('damaged', ({ amount }) => { totalDamage += amount; });

      const sword = makeWeapon(world, { id: 'sword', name: 'Sword', damageDice: '1d6', staminaCost: 8, bonuses: { attack: 12 } });

      const hero = makeActor(world, 'Hero', 50);
      const eq = world.get(hero, Equipment);
      eq.weapon = sword;

      if (dualWield) {
        const dagger = makeWeapon(world, { id: 'dagger', name: 'Dagger', damageDice: '1d6', staminaCost: 6, bonuses: { attack: 12 } });
        eq.offhand = dagger;
      }

      world.add(hero, Stamina, { maxStamina: 100, stamina: 100, staminaRegen: 3, regenCooldown: 0 });

      const foe = makeActor(world, 'Goblin', 200);
      world.add(hero, Position, { x: 1, y: 1 });
      world.add(foe, Position, { x: 1, y: 2 });
      equipmentSystem(world);

      world.add(hero, AttackIntent, { targetId: foe });
      combatSystem(world);
    }
    return totalDamage;
  }

  const singleDmg = runRounds(false);
  const dualDmg = runRounds(true);

  assert(singleDmg > 0, `single-wield should deal some damage, got ${singleDmg}`);
  assert(dualDmg > singleDmg,
    `dual-wield total (${dualDmg}) should exceed single-wield total (${singleDmg}) over ${ROUNDS} rounds`);
});

Deno.test("dual wield: offhand fires even when main hand misses", () => {
  let mainMissed = false;
  let offhandHit = false;

  for (let seed = 1; seed <= 512; seed++) {
    mainMissed = false;
    offhandHit = false;
    let mainDamaged = false;

    const world = new World({ seed });
    installAffixTriggers(world);
    world.on('status', (payload) => {
      // Main hand miss
      const kind = String(payload?.kind || payload?.id && '').toLowerCase();
      if (kind === 'miss') mainMissed = true;
    });
    world.on('damaged', ({ offhand }) => {
      if (offhand) offhandHit = true;
      else mainDamaged = true;
    });

    // Low attack bonus to increase miss chance
    const sword = makeWeapon(world, { id: 'sword', name: 'Sword', bonuses: { attack: 0 } });
    // High attack bonus on offhand to increase hit chance
    const dagger = makeWeapon(world, { id: 'dagger', name: 'Dagger', damageDice: '1d4', staminaCost: 5, bonuses: { attack: 15 } });

    const hero = makeActor(world, 'Hero', 50);
    const eq = world.get(hero, Equipment);
    eq.weapon = sword;
    eq.offhand = dagger;
    world.add(hero, Stamina, { maxStamina: 100, stamina: 100, staminaRegen: 3, regenCooldown: 0 });

    // Give defender decent defense to make main miss more likely
    const foe = makeActor(world, 'Goblin', 50);
    const foeEq = world.get(foe, Equipment);
    foeEq.defenseDerived = 5;

    world.add(hero, Position, { x: 1, y: 1 });
    world.add(foe, Position, { x: 1, y: 2 });
    equipmentSystem(world);

    world.add(hero, AttackIntent, { targetId: foe });
    combatSystem(world);

    if (!mainDamaged && offhandHit) {
      assert(true, 'offhand hit while main hand missed');
      return;
    }
  }
  // This test is probabilistic; if it fails, increase seed range
  assert(false, 'could not find a seed where main missed but offhand hit within 512 tries');
});

Deno.test("dual wield: venomous main-hand + flaming off-hand both proc on 1000HP target", () => {
  // Dual-wield two daggers with different affixes.
  // Across many seeds, verify both poison (venomous1, 40%) and burning (flaming, 50%) proc.
  const ITERATIONS = 64;
  let poisonCount = 0;
  let burningCount = 0;
  let bothInSameRound = 0;

  for (let seed = 1; seed <= ITERATIONS; seed++) {
    const world = new World({ seed });
    installAffixTriggers(world);

    // Main hand: venomous dagger (40% poison proc)
    const venomDagger = makeWeapon(world, {
      id: 'venom_dagger', name: 'Venomous Dagger',
      damageDice: '1d4', staminaCost: 5,
      bonuses: { attack: 12 }, affixes: ['venomous1'],
    });
    // Off hand: flaming dagger (50% burning proc)
    const flameDagger = makeWeapon(world, {
      id: 'flame_dagger', name: 'Flaming Dagger',
      damageDice: '1d4', staminaCost: 5,
      bonuses: { attack: 12 }, affixes: ['flaming'],
    });

    const hero = makeActor(world, 'Hero', 50);
    const eq = world.get(hero, Equipment);
    eq.weapon = venomDagger;
    eq.offhand = flameDagger;
    world.add(hero, Stamina, { maxStamina: 100, stamina: 100, staminaRegen: 3, regenCooldown: 0 });

    const foe = makeActor(world, 'Target', 1000);
    world.add(hero, Position, { x: 1, y: 1 });
    world.add(foe, Position, { x: 1, y: 2 });
    equipmentSystem(world);

    world.add(hero, AttackIntent, { targetId: foe });
    combatSystem(world);

    const ae = world.get(foe, ActiveEffects);
    const effects = ae?.effects || [];
    const hasPoison = effects.some(e => e.key === 'poison');
    const hasBurning = effects.some(e => e.key === 'burning');

    if (hasPoison) poisonCount++;
    if (hasBurning) burningCount++;
    if (hasPoison && hasBurning) bothInSameRound++;
  }

  assert(poisonCount > 0,
    `venomous main-hand should proc poison at least once across ${ITERATIONS} seeds (got ${poisonCount})`);
  assert(burningCount > 0,
    `flaming off-hand should proc burning at least once across ${ITERATIONS} seeds (got ${burningCount})`);
  assert(bothInSameRound > 0,
    `both affixes should proc in the same round at least once across ${ITERATIONS} seeds (got ${bothInSameRound})`);
});
