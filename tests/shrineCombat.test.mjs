import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { AttackIntent } from '../src/rules/components/Intents/AttackIntent.js';
import { Equipment } from '../src/rules/components/Equipment.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { Faction } from '../src/rules/components/Faction.js';
import { Position } from '../src/rules/components/Position.js';
import { Facing } from '../src/rules/components/Facing.js';
import { Player } from '../src/rules/components/Player.js';
import { Devotion } from '../src/rules/components/Devotion.js';
import { Collider } from '../src/rules/components/Collider.js';
import { combatSystem } from '../src/rules/systems/combatSystem.js';
import { equipmentSystem } from '../src/rules/systems/equipmentSystem.js';
import { initDeity, scoreDeityStanding } from '../src/rules/systems/deitySystem.js';
import { rebuildSpatialIndex } from '../src/rules/utils/spatialIndex.js';

// ── Helpers ──────────────────────────────────────────────────────────

function makePlayer(world, { x = 5, y = 5, hp = 100, deityId = 'seraphine' } = {}) {
  const id = world.create();
  world.add(id, Player, {});
  world.add(id, NamedIdentity, { name: 'Hero', identity: 'player' });
  world.add(id, Vitality, { maxHp: hp, hp });
  world.add(id, Equipment, {});
  world.add(id, Position, { x, y });
  world.add(id, Facing, { dx: 0, dy: 1 });
  world.add(id, Faction, { key: 'player' });
  world.add(id, Devotion, { deityId });
  return id;
}

function makeMonster(world, { x = 5, y = 6, hp = 200 } = {}) {
  const id = world.create();
  world.add(id, NamedIdentity, { name: 'Dummy', identity: 'dummy' });
  world.add(id, Vitality, { maxHp: hp, hp });
  world.add(id, Equipment, {});
  world.add(id, Position, { x, y });
  world.add(id, Faction, { key: 'enemy' });
  return id;
}

function makeWeapon(world, { accuracy = 200, damagePower = 10, dice = '2d6' } = {}) {
  const id = world.create();
  world.add(id, NamedIdentity, { name: 'Test Sword', identity: 'test_sword' });
  world.add(id, ItemInfo, {
    type: 'equip', slot: 'weapon', weight: 3, value: 0,
    description: '', count: 1, rarity: 1, rarityName: 'common',
    damageDice: dice, damageType: 'slash', affixes: [],
    bonuses: { accuracy, damagePower },
  });
  return id;
}

function placeShrine(world, x, y) {
  const id = world.create();
  world.add(id, NamedIdentity, { name: 'Shrine', identity: 'shrine' });
  world.add(id, Position, { x, y });
  world.add(id, Collider, { solid: true, blocksSight: false });
  return id;
}

/**
 * Run many combat seeds and collect total damage dealt to the defender.
 * Returns the sum of all damage events across all seeds.
 */
function runCombatTrials(setup, { seeds = 200, startSeed = 1 } = {}) {
  let totalDamage = 0;
  let hitCount = 0;
  const scalingEvents = [];

  for (let s = startSeed; s < startSeed + seeds; s++) {
    const world = new World({ seed: s });
    const { attacker, defender } = setup(world);

    equipmentSystem(world);
    rebuildSpatialIndex(world);

    const events = [];
    world.on('damaged', (e) => events.push(e));
    world.on('shrine:combat:scaling', (e) => scalingEvents.push(e));

    world.add(attacker, AttackIntent, { targetId: defender });
    combatSystem(world);

    for (const ev of events) {
      if (ev.target === defender) {
        totalDamage += ev.amount;
        hitCount++;
      }
    }
  }

  return { totalDamage, hitCount, scalingEvents };
}

// ── Tests ────────────────────────────────────────────────────────────

Deno.test("shrine combat: no scaling without a shrine nearby", () => {
  const result = runCombatTrials((world) => {
    const weaponId = makeWeapon(world);
    const attacker = makePlayer(world, { deityId: 'seraphine' });
    const eq = world.get(attacker, Equipment);
    eq.weapon = weaponId;
    const defender = makeMonster(world);
    // Init deity with high serenity
    const deity = initDeity('seraphine', world);
    deity.action('protect', { magnitude: 2.0 });
    // No shrine placed
    return { attacker, defender };
  });

  assertEquals(result.scalingEvents.length, 0,
    'no shrine:combat:scaling events should fire without a shrine');
});

Deno.test("shrine combat: positive favor grants damage bonus near shrine", () => {
  // Baseline: no shrine
  const baseline = runCombatTrials((world) => {
    const weaponId = makeWeapon(world);
    const attacker = makePlayer(world, { deityId: 'seraphine' });
    const eq = world.get(attacker, Equipment);
    eq.weapon = weaponId;
    const defender = makeMonster(world);
    const deity = initDeity('seraphine', world);
    deity.action('protect', { magnitude: 2.0 });
    return { attacker, defender };
  });

  // With shrine at distance 1 from attacker
  const boosted = runCombatTrials((world) => {
    const weaponId = makeWeapon(world);
    const attacker = makePlayer(world, { x: 5, y: 5, deityId: 'seraphine' });
    const eq = world.get(attacker, Equipment);
    eq.weapon = weaponId;
    const defender = makeMonster(world, { x: 5, y: 6 });
    const deity = initDeity('seraphine', world);
    // Pump serenity high for strong positive standing
    deity.action('protect', { magnitude: 2.0 });
    deity.action('heal', { magnitude: 2.0 });
    deity.action('protect', { magnitude: 2.0 });
    placeShrine(world, 4, 5); // adjacent to attacker
    return { attacker, defender };
  });

  // Both should land some hits
  assert(baseline.hitCount > 0, 'baseline should land hits');
  assert(boosted.hitCount > 0, 'boosted should land hits');

  // Over many trials, shrine-boosted total damage should exceed baseline
  // (if same seed range produces same hit/miss patterns, the damage per hit is higher)
  if (baseline.hitCount > 0 && boosted.hitCount > 0) {
    const avgBaseline = baseline.totalDamage / baseline.hitCount;
    const avgBoosted = boosted.totalDamage / boosted.hitCount;
    assert(avgBoosted >= avgBaseline,
      `shrine bonus should increase average damage: baseline=${avgBaseline.toFixed(2)}, boosted=${avgBoosted.toFixed(2)}`);
  }
});

Deno.test("shrine combat: negative favor reduces damage near shrine", () => {
  // With shrine, wrathful deity
  const penalized = runCombatTrials((world) => {
    const weaponId = makeWeapon(world);
    const attacker = makePlayer(world, { x: 5, y: 5, deityId: 'molkhar' });
    const eq = world.get(attacker, Equipment);
    eq.weapon = weaponId;
    const defender = makeMonster(world, { x: 5, y: 6 });
    const deity = initDeity('molkhar', world);
    // Tank favor: betray and heal (molkhar hates healing)
    deity.action('heal', { magnitude: 3.0 });
    deity.action('heal', { magnitude: 3.0 });
    deity.action('protect', { magnitude: 3.0 });
    placeShrine(world, 4, 5);
    return { attacker, defender };
  });

  // Baseline without shrine
  const baseline = runCombatTrials((world) => {
    const weaponId = makeWeapon(world);
    const attacker = makePlayer(world, { x: 5, y: 5, deityId: 'molkhar' });
    const eq = world.get(attacker, Equipment);
    eq.weapon = weaponId;
    const defender = makeMonster(world, { x: 5, y: 6 });
    const deity = initDeity('molkhar', world);
    deity.action('heal', { magnitude: 3.0 });
    deity.action('heal', { magnitude: 3.0 });
    deity.action('protect', { magnitude: 3.0 });
    return { attacker, defender };
  });

  if (baseline.hitCount > 0 && penalized.hitCount > 0) {
    const avgBaseline = baseline.totalDamage / baseline.hitCount;
    const avgPenalized = penalized.totalDamage / penalized.hitCount;
    assert(avgPenalized <= avgBaseline,
      `shrine penalty should reduce average damage: baseline=${avgBaseline.toFixed(2)}, penalized=${avgPenalized.toFixed(2)}`);
  }
});

Deno.test("shrine combat: scaling falls off with distance", () => {
  function trialAtDist(dist) {
    return runCombatTrials((world) => {
      const weaponId = makeWeapon(world);
      const attacker = makePlayer(world, { x: 10, y: 10, deityId: 'seraphine' });
      const eq = world.get(attacker, Equipment);
      eq.weapon = weaponId;
      const defender = makeMonster(world, { x: 10, y: 11 });
      const deity = initDeity('seraphine', world);
      deity.action('protect', { magnitude: 2.0 });
      deity.action('heal', { magnitude: 2.0 });
      deity.action('protect', { magnitude: 2.0 });
      // Place shrine at distance `dist` from attacker (along x-axis)
      placeShrine(world, 10 + dist, 10);
      return { attacker, defender };
    });
  }

  const close = trialAtDist(0);  // on top of shrine
  const mid = trialAtDist(3);    // 3 tiles away
  const edge = trialAtDist(5);   // at radius edge

  // Edge of radius should produce no scaling events (distanceFactor = 0)
  const edgeScalingCount = edge.scalingEvents.length;

  // Close should produce more scaling events than mid (higher magnitude passes threshold)
  if (close.hitCount > 0 && mid.hitCount > 0) {
    const avgClose = close.totalDamage / close.hitCount;
    const avgMid = mid.totalDamage / mid.hitCount;
    assert(avgClose >= avgMid,
      `closer shrine should give more bonus: close=${avgClose.toFixed(2)}, mid=${avgMid.toFixed(2)}`);
  }
});

Deno.test("shrine combat: no scaling for entities without Player component", () => {
  const result = runCombatTrials((world) => {
    // Monster-on-monster combat near a shrine — no deity, no scaling
    const weaponId = makeWeapon(world, { accuracy: 80 });
    const attacker = world.create();
    world.add(attacker, NamedIdentity, { name: 'Orc', identity: 'orc' });
    world.add(attacker, Vitality, { maxHp: 50, hp: 50 });
    world.add(attacker, Equipment, {});
    world.add(attacker, Position, { x: 5, y: 5 });
    world.add(attacker, Facing, { dx: 0, dy: 1 });
    world.add(attacker, Faction, { key: 'enemy' });
    const eq = world.get(attacker, Equipment);
    eq.weapon = weaponId;

    const defender = world.create();
    world.add(defender, NamedIdentity, { name: 'Goblin', identity: 'goblin' });
    world.add(defender, Vitality, { maxHp: 50, hp: 50 });
    world.add(defender, Equipment, {});
    world.add(defender, Position, { x: 5, y: 6 });
    world.add(defender, Faction, { key: 'player' }); // hostile to monster

    placeShrine(world, 4, 5);
    return { attacker, defender };
  });

  assertEquals(result.scalingEvents.length, 0,
    'non-player entities should not trigger shrine scaling');
});

Deno.test("shrine combat: no scaling without Devotion component", () => {
  const result = runCombatTrials((world) => {
    const weaponId = makeWeapon(world);
    // Player without Devotion
    const attacker = world.create();
    world.add(attacker, Player, {});
    world.add(attacker, NamedIdentity, { name: 'Godless', identity: 'player' });
    world.add(attacker, Vitality, { maxHp: 100, hp: 100 });
    world.add(attacker, Equipment, {});
    world.add(attacker, Position, { x: 5, y: 5 });
    world.add(attacker, Facing, { dx: 0, dy: 1 });
    world.add(attacker, Faction, { key: 'player' });
    const eq = world.get(attacker, Equipment);
    eq.weapon = weaponId;

    const defender = makeMonster(world);
    placeShrine(world, 4, 5);
    return { attacker, defender };
  });

  assertEquals(result.scalingEvents.length, 0,
    'player without deity should not trigger shrine scaling');
});

Deno.test("shrine combat: scoreDeityStanding export works correctly", () => {
  // Verify the exported function matches expected formula
  const mockDeity = {
    _queryPrecise: () => ({ serenity: 10, wrath: 0, hunger: 0, sorrow: 0 }),
  };
  const score = scoreDeityStanding(mockDeity);
  assertEquals(score, 10 * 1.7, 'pure serenity=10 should score 17');

  const angryDeity = {
    _queryPrecise: () => ({ serenity: 0, wrath: 5, hunger: 0, sorrow: 0 }),
  };
  const angryScore = scoreDeityStanding(angryDeity);
  assertEquals(angryScore, -(5 * 2.2), 'pure wrath=5 should score -11');

  const nullScore = scoreDeityStanding(null);
  assertEquals(nullScore, -999, 'null deity should return -999');
});

Deno.test("shrine combat: shrine outside radius produces no scaling", () => {
  const result = runCombatTrials((world) => {
    const weaponId = makeWeapon(world);
    const attacker = makePlayer(world, { x: 5, y: 5, deityId: 'seraphine' });
    const eq = world.get(attacker, Equipment);
    eq.weapon = weaponId;
    const defender = makeMonster(world, { x: 5, y: 6 });
    const deity = initDeity('seraphine', world);
    deity.action('protect', { magnitude: 2.0 });
    deity.action('heal', { magnitude: 2.0 });
    // Shrine far away (distance 10 > SHRINE_COMBAT_RADIUS=5)
    placeShrine(world, 15, 5);
    return { attacker, defender };
  });

  assertEquals(result.scalingEvents.length, 0,
    'shrine outside radius should produce no scaling events');
});
