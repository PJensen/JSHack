import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Equipment } from '../src/rules/components/Equipment.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { Faction } from '../src/rules/components/Faction.js';
import { Position } from '../src/rules/components/Position.js';
import { ActiveEffects } from '../src/rules/components/ActiveEffects.js';
import { Mana } from '../src/rules/components/Mana.js';
import { Stamina } from '../src/rules/components/Stamina.js';
import { installAffixTriggers } from '../src/rules/systems/affixTriggerSystem.js';
import { equipmentSystem } from '../src/rules/systems/equipmentSystem.js';
import { resolveMeleeAttack } from '../src/rules/systems/combatSystem.js';
import { rebuildSpatialIndex } from '../src/rules/utils/spatialIndex.js';
import { buildCatalogItem } from '../src/rules/data/itemCatalogLoader.js';
import { dealDamage } from '../src/rules/utils/dealDamage.js';
import { evaluateEquippedAffixProcs } from '../src/rules/utils/affixTopology.js';
import { applyProcAccumulator } from '../src/rules/utils/procApplication.js';
import { registerAffixDefinition, unregisterAffixDefinition } from '../src/rules/data/affixes.js';

// Force affix registration
await import('../src/rules/data/affixes.js');

function makeEquip(world, { slot, bonuses, affixes, damageDice }) {
  const eid = world.create();
  world.add(eid, NamedIdentity, { name: 'TestGear', identity: 'test_gear' });
  world.add(eid, ItemInfo, {
    type: 'equip', slot: slot || 'weapon', weight: 1, value: 0, description: '',
    count: 1, bonuses: bonuses || {}, rarity: 1, rarityName: 'common',
    affixes: affixes || [], damageDice: damageDice || null,
  });
  return eid;
}

function makeActor(world, { x, y, hp, maxHp, faction, mana, maxMana, stamina, maxStamina }) {
  const id = world.create();
  world.add(id, NamedIdentity, { name: 'Actor', identity: 'actor' });
  world.add(id, Vitality, { maxHp: maxHp || hp || 50, hp: hp || 50 });
  world.add(id, Equipment, {});
  world.add(id, Position, { x, y });
  if (faction) world.add(id, Faction, { key: faction });
  if (mana != null) world.add(id, Mana, { maxMana: maxMana || mana, mana });
  if (stamina != null) world.add(id, Stamina, { maxStamina: maxStamina || stamina, stamina });
  world.add(id, ActiveEffects, { effects: [] });
  return id;
}

// ── Firestorm: applies burning on hit ──────────────────────────────

Deno.test("firestorm1 affix applies burning to defender", () => {
  // Try multiple seeds to find one where the proc fires (12% chance)
  for (let s = 1; s <= 200; s++) {
    const world = new World({ seed: s });
    installAffixTriggers(world);

    const weapon = makeEquip(world, { slot: 'weapon', bonuses: { attack: 10 }, affixes: ['firestorm1'], damageDice: '1d8' });
    const hero = makeActor(world, { x: 1, y: 1, hp: 50, faction: 'player' });
    const foe = makeActor(world, { x: 1, y: 2, hp: 50, faction: 'enemy' });
    world.get(hero, Equipment).weapon = weapon;
    equipmentSystem(world);
    resolveMeleeAttack(world, hero, foe);

    const ae = world.get(foe, ActiveEffects);
    const hasBurning = ae && ae.effects.some(e => e.key === 'burning');
    if (hasBurning) {
      assert(true, 'firestorm applied burning');
      return;
    }
  }
  assert(false, 'firestorm never procced in 200 seeds');
});

// ── Frostbite: applies frost on hit ────────────────────────────────

Deno.test("frostbite1 affix applies frost to defender", () => {
  for (let s = 1; s <= 200; s++) {
    const world = new World({ seed: s });
    installAffixTriggers(world);

    const weapon = makeEquip(world, { slot: 'weapon', bonuses: { attack: 10 }, affixes: ['frostbite1'], damageDice: '1d8' });
    const hero = makeActor(world, { x: 1, y: 1, hp: 50, faction: 'player' });
    const foe = makeActor(world, { x: 1, y: 2, hp: 50, faction: 'enemy' });
    world.get(hero, Equipment).weapon = weapon;
    equipmentSystem(world);
    resolveMeleeAttack(world, hero, foe);

    const ae = world.get(foe, ActiveEffects);
    const hasFrost = ae && ae.effects.some(e => e.key === 'frost');
    if (hasFrost) {
      assert(true, 'frostbite applied frost');
      return;
    }
  }
  assert(false, 'frostbite never procced in 200 seeds');
});

// ── Hemorrhage: applies bleed on hit ───────────────────────────────

Deno.test("hemorrhage1 affix applies bleed to defender", () => {
  for (let s = 1; s <= 200; s++) {
    const world = new World({ seed: s });
    installAffixTriggers(world);

    const weapon = makeEquip(world, { slot: 'weapon', bonuses: { attack: 10 }, affixes: ['hemorrhage1'], damageDice: '1d8' });
    const hero = makeActor(world, { x: 1, y: 1, hp: 50, faction: 'player' });
    const foe = makeActor(world, { x: 1, y: 2, hp: 50, faction: 'enemy' });
    world.get(hero, Equipment).weapon = weapon;
    equipmentSystem(world);
    resolveMeleeAttack(world, hero, foe);

    const ae = world.get(foe, ActiveEffects);
    const hasBleed = ae && ae.effects.some(e => e.key === 'bleed');
    if (hasBleed) {
      assert(true, 'hemorrhage applied bleed');
      return;
    }
  }
  assert(false, 'hemorrhage never procced in 200 seeds');
});

// ── Stunning: applies stun to defender ─────────────────────────────

Deno.test("stunning1 affix applies stun to defender", () => {
  for (let s = 1; s <= 200; s++) {
    const world = new World({ seed: s });
    installAffixTriggers(world);

    const weapon = makeEquip(world, { slot: 'weapon', bonuses: { attack: 10 }, affixes: ['stunning1'], damageDice: '1d8' });
    const hero = makeActor(world, { x: 1, y: 1, hp: 50, faction: 'player' });
    const foe = makeActor(world, { x: 1, y: 2, hp: 50, faction: 'enemy' });
    world.get(hero, Equipment).weapon = weapon;
    equipmentSystem(world);
    resolveMeleeAttack(world, hero, foe);

    const ae = world.get(foe, ActiveEffects);
    const hasStun = ae && ae.effects.some(e => e.key === 'stun');
    if (hasStun) {
      assert(true, 'stunning applied stun');
      return;
    }
  }
  assert(false, 'stunning never procced in 200 seeds');
});

// ── Berserk: applies berserk to attacker ───────────────────────────

Deno.test("berserk1 affix applies berserk to attacker", () => {
  for (let s = 1; s <= 200; s++) {
    const world = new World({ seed: s });
    installAffixTriggers(world);

    const weapon = makeEquip(world, { slot: 'weapon', bonuses: { attack: 10 }, affixes: ['berserk1'], damageDice: '1d8' });
    const hero = makeActor(world, { x: 1, y: 1, hp: 50, faction: 'player' });
    const foe = makeActor(world, { x: 1, y: 2, hp: 50, faction: 'enemy' });
    world.get(hero, Equipment).weapon = weapon;
    equipmentSystem(world);
    resolveMeleeAttack(world, hero, foe);

    const ae = world.get(hero, ActiveEffects);
    const hasBerserk = ae && ae.effects.some(e => e.key === 'berserk');
    if (hasBerserk) {
      assert(true, 'berserk applied to attacker');
      return;
    }
  }
  assert(false, 'berserk never procced in 200 seeds');
});

// ── Soul Drain: heals attacker ─────────────────────────────────────

Deno.test("soulDrain1 affix heals attacker on hit", () => {
  for (let s = 1; s <= 200; s++) {
    const world = new World({ seed: s });
    installAffixTriggers(world);

    const weapon = makeEquip(world, { slot: 'weapon', bonuses: { attack: 10 }, affixes: ['soulDrain1'], damageDice: '1d8' });
    const hero = makeActor(world, { x: 1, y: 1, hp: 30, faction: 'player' });
    const foe = makeActor(world, { x: 1, y: 2, hp: 50, faction: 'enemy' });
    world.get(hero, Vitality).maxHp = 50;
    world.get(hero, Equipment).weapon = weapon;
    equipmentSystem(world);
    resolveMeleeAttack(world, hero, foe);

    const heroHp = world.get(hero, Vitality).hp;
    if (heroHp > 30) {
      assert(true, `soul drain healed attacker to ${heroHp}`);
      return;
    }
  }
  assert(false, 'soulDrain never procced in 200 seeds');
});

// ── Mana Surge: restores mana to attacker ──────────────────────────

Deno.test("manaSurge1 affix restores mana to attacker", () => {
  for (let s = 1; s <= 200; s++) {
    const world = new World({ seed: s });
    installAffixTriggers(world);

    const weapon = makeEquip(world, { slot: 'weapon', bonuses: { attack: 10 }, affixes: ['manaSurge1'], damageDice: '1d8' });
    const hero = makeActor(world, { x: 1, y: 1, hp: 50, faction: 'player', mana: 10, maxMana: 50, stamina: 100 });
    const foe = makeActor(world, { x: 1, y: 2, hp: 50, faction: 'enemy' });
    world.get(hero, Equipment).weapon = weapon;
    equipmentSystem(world);
    resolveMeleeAttack(world, hero, foe);

    const mana = world.get(hero, Mana).mana;
    if (mana > 10) {
      assert(mana <= 13, `mana should be at most 13, got ${mana}`);
      return;
    }
  }
  assert(false, 'manaSurge never procced in 200 seeds');
});

// ── Executioner: +3 damage when defender below 30% HP ──────────────

Deno.test("executioner1 affix adds damage below 30% HP threshold", () => {
  // Executioner is 100% when HP < 30%, so compare damage dealt to low-HP vs high-HP target
  const world = new World({ seed: 42 });
  installAffixTriggers(world);

  const weapon1 = makeEquip(world, { slot: 'weapon', bonuses: { attack: 10 }, affixes: ['executioner1'], damageDice: '1d8' });
  const hero1 = makeActor(world, { x: 1, y: 1, hp: 50, faction: 'player' });
  const lowFoe = makeActor(world, { x: 1, y: 2, hp: 30, maxHp: 200, faction: 'enemy' });
  world.get(hero1, Equipment).weapon = weapon1;
  equipmentSystem(world);
  resolveMeleeAttack(world, hero1, lowFoe);
  const lowFoeHp = world.get(lowFoe, Vitality).hp;

  const world2 = new World({ seed: 42 });
  installAffixTriggers(world2);
  const weapon2 = makeEquip(world2, { slot: 'weapon', bonuses: { attack: 10 }, affixes: ['executioner1'], damageDice: '1d8' });
  const hero2 = makeActor(world2, { x: 1, y: 1, hp: 50, faction: 'player' });
  const highFoe = makeActor(world2, { x: 1, y: 2, hp: 200, faction: 'enemy' });
  // highFoe at 200/200 = 100% HP -- above threshold
  world2.get(hero2, Equipment).weapon = weapon2;
  equipmentSystem(world2);
  resolveMeleeAttack(world2, hero2, highFoe);
  const highFoeHp = world2.get(highFoe, Vitality).hp;

  const lowDmg = 30 - lowFoeHp;
  const highDmg = 200 - highFoeHp;
  assert(lowDmg === highDmg + 3, `executioner should add +3 dmg: low took ${lowDmg}, high took ${highDmg}`);
});

// ── Shield Wall: stoneskin on damaged ──────────────────────────────

Deno.test("shieldWall1 affix applies stoneskin on damaged event", () => {
  for (let s = 1; s <= 200; s++) {
    const world = new World({ seed: s });
    installAffixTriggers(world);

    const shield = makeEquip(world, { slot: 'offhand', bonuses: {}, affixes: ['shieldWall1'] });
    const defender = makeActor(world, { x: 1, y: 1, hp: 50, faction: 'player' });
    const attacker = makeActor(world, { x: 1, y: 2, hp: 50, faction: 'enemy' });
    world.get(defender, Equipment).offhand = shield;
    equipmentSystem(world);

    dealDamage(world, { target: defender, amount: 5, source: attacker });

    const ae = world.get(defender, ActiveEffects);
    const hasStoneskin = ae && ae.effects.some(e => e.key === 'stoneskin');
    if (hasStoneskin) {
      assert(true, 'shieldWall applied stoneskin');
      return;
    }
  }
  assert(false, 'shieldWall never procced in 200 seeds');
});

// ── Second Wind: regen + stamina on damaged ────────────────────────

Deno.test("secondWind1 affix applies regen and restores stamina on damaged", () => {
  for (let s = 1; s <= 200; s++) {
    const world = new World({ seed: s });
    installAffixTriggers(world);

    const armor = makeEquip(world, { slot: 'armor', bonuses: {}, affixes: ['secondWind1'] });
    const defender = makeActor(world, { x: 1, y: 1, hp: 50, faction: 'player', stamina: 80, maxStamina: 100 });
    const attacker = makeActor(world, { x: 1, y: 2, hp: 50, faction: 'enemy' });
    world.get(defender, Equipment).armor = armor;
    equipmentSystem(world);

    dealDamage(world, { target: defender, amount: 5, source: attacker });

    const ae = world.get(defender, ActiveEffects);
    const hasRegen = ae && ae.effects.some(e => e.key === 'regen');
    if (hasRegen) {
      const stam = world.get(defender, Stamina);
      assert(stam.stamina === 85, `stamina should be 85, got ${stam.stamina}`);
      assert(true, 'secondWind applied regen and restored stamina');
      return;
    }
  }
  assert(false, 'secondWind never procced in 200 seeds');
});

// ── Chain Lightning: damages target + chains to nearby ─────────────

Deno.test("chainLightning1 affix chains to nearby hostile", () => {
  for (let s = 1; s <= 200; s++) {
    const world = new World({ seed: s });
    installAffixTriggers(world);

    const weapon = makeEquip(world, { slot: 'weapon', bonuses: { attack: 10 }, affixes: ['chainLightning1'], damageDice: '1d8' });
    const hero = makeActor(world, { x: 5, y: 5, hp: 50, faction: 'player' });
    const foe = makeActor(world, { x: 5, y: 6, hp: 50, faction: 'enemy' });
    const bystander = makeActor(world, { x: 6, y: 6, hp: 50, faction: 'enemy' });
    world.get(hero, Equipment).weapon = weapon;

    rebuildSpatialIndex(world);
    equipmentSystem(world);
    resolveMeleeAttack(world, hero, foe);

    const bystanderHp = world.get(bystander, Vitality).hp;
    if (bystanderHp < 50) {
      assert(bystanderHp === 49, `bystander should take 1 chain dmg, hp=${bystanderHp}`);
      return;
    }
  }
  assert(false, 'chainLightning never procced in 200 seeds');
});

Deno.test("capacitive1 does not self-damage on mismatched source context", () => {
  const world = new World({ seed: 77 });
  const weapon = makeEquip(world, { slot: 'weapon', bonuses: { attack: 10 }, affixes: ['capacitive1'], damageDice: '1d8' });
  const hero = makeActor(world, { x: 2, y: 2, hp: 20, faction: 'player' });
  const foe = makeActor(world, { x: 2, y: 3, hp: 20, faction: 'enemy' });
  world.get(hero, Equipment).weapon = weapon;
  equipmentSystem(world);

  const heroHpBefore = world.get(hero, Vitality).hp;
  const out = evaluateEquippedAffixProcs(world, hero, {
    kind: 'onHit',
    source: foe,
    target: hero,
    damage: { amount: 5, type: 'blunt', crit: false, blocked: false },
    tags: new Set(['melee']),
    scratch: {},
  });
  applyProcAccumulator(world, out, { applyDamage: dealDamage });

  const heroHpAfter = world.get(hero, Vitality).hp;
  assert(heroHpAfter === heroHpBefore, `capacitive proc should not damage proc owner on mismatched context (before=${heroHpBefore}, after=${heroHpAfter})`);
});

Deno.test("flaming does not self-ignite on mismatched source context", () => {
  const world = new World({ seed: 88 });
  const weapon = makeEquip(world, { slot: 'weapon', bonuses: { attack: 10 }, affixes: ['flaming'], damageDice: '1d8' });
  const hero = makeActor(world, { x: 2, y: 2, hp: 20, faction: 'player' });
  const foe = makeActor(world, { x: 2, y: 3, hp: 20, faction: 'enemy' });
  world.get(hero, Equipment).weapon = weapon;
  equipmentSystem(world);

  const before = world.get(hero, ActiveEffects)?.effects?.slice() || [];
  const out = evaluateEquippedAffixProcs(world, hero, {
    kind: 'onHit',
    source: foe,
    target: hero,
    damage: { amount: 5, type: 'slash', crit: false, blocked: false },
    tags: new Set(['melee']),
    scratch: {},
  });
  applyProcAccumulator(world, out, { applyDamage: dealDamage });

  const after = world.get(hero, ActiveEffects)?.effects || [];
  const hasBurning = after.some((e) => e.key === 'burn' || e.key === 'burning');
  assert(!hasBurning, `flaming proc should not ignite proc owner on mismatched context (before=${before.length}, after=${after.length})`);
});

Deno.test("ember_knife vs snake never ignites attacker", () => {
  for (let seed = 1; seed <= 256; seed++) {
    const world = new World({ seed });
    installAffixTriggers(world);

    const hero = makeActor(world, { x: 1, y: 1, hp: 50, faction: 'player' });
    const snake = makeActor(world, { x: 1, y: 2, hp: 50, faction: 'enemy' });
    const emberKnife = buildCatalogItem(world, 'ember_knife');
    world.get(hero, Equipment).weapon = emberKnife;

    equipmentSystem(world);
    resolveMeleeAttack(world, hero, snake);

    const heroEffects = world.get(hero, ActiveEffects)?.effects || [];
    const selfBurning = heroEffects.some((e) => e.key === 'burn' || e.key === 'burning');
    assert(!selfBurning, `seed ${seed}: ember_knife attack should not ignite attacker`);
  }
});

// ── Inherent affix merge ───────────────────────────────────────────

Deno.test("buildCatalogItem merges inherent affixes with provided ones", () => {
  const world = new World({ seed: 1 });

  // caustic_stiletto has inherent affixes: ["caustic1"]
  const id1 = buildCatalogItem(world, "caustic_stiletto", { affixes: ["fierce"] });
  const info1 = world.get(id1, ItemInfo);
  assert(info1.affixes.includes("caustic1"), "inherent caustic1 should be present");
  assert(info1.affixes.includes("fierce"), "provided fierce should also be present");

  // Without opts.affixes, inherent should still appear
  const id2 = buildCatalogItem(world, "nightfang_dagger");
  const info2 = world.get(id2, ItemInfo);
  assert(info2.affixes.includes("venomous1"), "nightfang should have inherent venomous1");

  // Signature proc weapon
  const id3 = buildCatalogItem(world, "stormcaller_blade");
  const info3 = world.get(id3, ItemInfo);
  assert(info3.affixes.includes("chainLightning1"), "stormcaller should have chainLightning1");
  assert(info3.affixes.includes("capacitive1"), "stormcaller should have capacitive1");
});

Deno.test("mace-family catalog items include inherent stunning1 affix", () => {
  const world = new World({ seed: 1 });
  const maceIds = [
    "iron_mace",
    "warhammer",
    "stormtouched_mace",
    "warhammer_of_fury",
    "pyreheart_mace",
    "howling_maul",
  ];

  for (const equipId of maceIds) {
    const id = buildCatalogItem(world, equipId);
    const info = world.get(id, ItemInfo);
    assert(info.affixes.includes("stunning1"), `${equipId} should include stunning1`);
  }
});

// ── Shield slot fix ────────────────────────────────────────────────

Deno.test("shield affixes fire on damaged event", async () => {
  const world = new World({ seed: 1 });
  installAffixTriggers(world);

  let fired = false;
  const { registerScript, ScriptVerb } = await import('../src/rules/scripting.js');
  registerScript('affix:test_shield_slot', {
    [ScriptVerb.ProcEvaluate]: () => { fired = true; }
  });
  registerAffixDefinition('test_shield_slot', {
    name: 'Test Shield Slot', slots: ['offhand'], weight: 1,
    triggerScripts: { onDamaged: ['affix:test_shield_slot'] },
  });

  const shield = makeEquip(world, { slot: 'offhand', bonuses: {}, affixes: ['test_shield_slot'] });
  const defender = makeActor(world, { x: 1, y: 1, hp: 50 });
  const attacker = makeActor(world, { x: 1, y: 2, hp: 50 });
  world.get(defender, Equipment).offhand = shield;

  dealDamage(world, { target: defender, amount: 5, source: attacker });

  assert(fired, 'offhand affix should have fired on damaged event');
  unregisterAffixDefinition('test_shield_slot');
});
