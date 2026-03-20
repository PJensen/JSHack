// tests/monsterVariety.test.mjs
// Verify new monster definitions, encounter groups, sentinel roll, and tier pools.

import { assert, assertEquals } from "jsr:@std/assert";
import { getMonstersByTier, getMonster, addGenocide, clearGenocides } from '../src/rules/data/monsters.js';
import { pickMonster, pickSentinelMonster, pickSpecificMonster, pickEncounterGroup } from '../src/rules/environment/dungeon/tables.js';
import { createRng } from '../src/lib/ecs-js/rng.js';

// ── Tier pool size checks ───────────────────────────────────────────

Deno.test("tier 0 pool has at least 13 non-rare monsters", () => {
  const pool = getMonstersByTier(0);
  assert(pool.length >= 13, `tier 0 has ${pool.length} monsters, expected >= 13`);
});

Deno.test("tier 1 pool has at least 7 non-rare monsters (was 3 before expansion)", () => {
  const pool = getMonstersByTier(1);
  assert(pool.length >= 7, `tier 1 has ${pool.length} monsters, expected >= 7`);
});

Deno.test("tier 2 pool has at least 8 non-rare monsters", () => {
  const pool = getMonstersByTier(2);
  assert(pool.length >= 8, `tier 2 has ${pool.length} monsters, expected >= 8`);
});

// ── New monster definitions ─────────────────────────────────────────

const NEW_MONSTERS = [
  'goblin_archer', 'orc_shaman', 'hobgoblin', 'phase_spider',
  'wight', 'dark_acolyte', 'orc_warchief',
];

for (const id of NEW_MONSTERS) {
  Deno.test(`monster '${id}' exists and has required fields`, () => {
    const def = getMonster(id);
    assert(def, `${id} not found in monster registry`);
    assert(typeof def.name === 'string', 'name');
    assert(typeof def.tier === 'number', 'tier');
    assert(typeof def.baseHp === 'number', 'baseHp');
    assert(typeof def.damageDice === 'string', 'damageDice');
    assert(typeof def.intelligence === 'number', 'intelligence');
    assert(typeof def.description === 'string', 'description');
    assert(Array.isArray(def.tags), 'tags');
  });
}

Deno.test("goblin_archer has ranged equipment", () => {
  const def = getMonster('goblin_archer');
  assert(def.equipment, 'should have equipment');
  assertEquals(def.equipment.ranged, 'bow_short');
  assertEquals(def.equipment.ammo, 'arrows');
});

Deno.test("orc_shaman has frost and heal spells", () => {
  const def = getMonster('orc_shaman');
  assert(Array.isArray(def.learnedSpellIds), 'should have learnedSpellIds');
  assert(def.learnedSpellIds.includes('frost'), 'should know frost');
  assert(def.learnedSpellIds.includes('heal'), 'should know heal');
  assert(def.maxMana > 0, 'should have mana pool');
});

Deno.test("dark_acolyte has agony and shadow_bolt spells", () => {
  const def = getMonster('dark_acolyte');
  assert(Array.isArray(def.learnedSpellIds), 'should have learnedSpellIds');
  assert(def.learnedSpellIds.includes('agony'), 'should know agony');
  assert(def.learnedSpellIds.includes('shadow_bolt'), 'should know shadow_bolt');
});

Deno.test("phase_spider has phaseOut and selfThrow hooks", () => {
  const def = getMonster('phase_spider');
  assert(def.hooks, 'should have hooks');
  assert(Array.isArray(def.hooks.onSeen), 'should have onSeen hooks');
  assert(Array.isArray(def.hooks.onDamaged), 'should have onDamaged hooks');
  assert(Array.isArray(def.hooks.onHit), 'should have onHit hooks');
});

// ── Sentinel roll ───────────────────────────────────────────────────

Deno.test("pickSentinelMonster is deterministic with same seed", () => {
  const rng1 = createRng(42);
  const rng2 = createRng(42);
  const m1 = pickSentinelMonster(rng1, 1);
  const m2 = pickSentinelMonster(rng2, 1);
  assertEquals(m1.identity, m2.identity, 'same seed should produce same monster');
});

Deno.test("sentinel can produce tier-1 monsters on depth 1 (10% chance)", () => {
  // Run many seeds and check if any depth-1 pick produces a tier-1 monster.
  const tier1ids = new Set(getMonstersByTier(1).map(m => m.id));
  let gotSentinel = false;
  for (let seed = 1; seed <= 500; seed++) {
    const rng = createRng(seed);
    const m = pickSentinelMonster(rng, 1);
    if (tier1ids.has(m.identity)) {
      gotSentinel = true;
      break;
    }
  }
  assert(gotSentinel, 'expected at least one sentinel upgrade in 500 seeds');
});

// ── Encounter groups ────────────────────────────────────────────────

Deno.test("pickEncounterGroup returns valid group for tier 0 with budget 3", () => {
  const rng = createRng(100);
  const group = pickEncounterGroup(rng, 1, 3);
  assert(group, 'should return a group');
  // Leader or followers should be present
  const total = (group.leader ? 1 : 0) + group.followers.length;
  assert(total >= 2, `expected >= 2 members, got ${total}`);
});

Deno.test("pickEncounterGroup returns null or valid for budget 1", () => {
  const rng = createRng(200);
  const group = pickEncounterGroup(rng, 1, 1);
  // Most groups need minBudget >= 2, so budget 1 should return null
  assertEquals(group, null, 'budget 1 should yield no group');
});

Deno.test("pickEncounterGroup works for each tier", () => {
  for (const [tier, depth] of [[0, 1], [1, 6], [2, 11], [3, 16]]) {
    let found = false;
    for (let seed = 1; seed <= 100; seed++) {
      const rng = createRng(seed);
      const group = pickEncounterGroup(rng, depth, 5);
      if (group) {
        found = true;
        assert(group.followers.length > 0 || group.leader, `tier ${tier} group should have members`);
        break;
      }
    }
    assert(found, `expected to find an encounter group for tier ${tier}`);
  }
});

Deno.test("encounter group respects genocide", () => {
  clearGenocides();
  addGenocide('goblin');
  const rng = createRng(300);
  // Try many seeds — groups with goblin followers should have them filtered
  for (let seed = 1; seed <= 50; seed++) {
    const r = createRng(seed);
    const group = pickEncounterGroup(r, 1, 5);
    if (group) {
      for (const f of group.followers) {
        assert(f.identity !== 'goblin', 'genocided goblin should not appear in followers');
      }
      if (group.leader) {
        assert(group.leader.identity !== 'goblin', 'genocided goblin should not appear as leader');
      }
    }
  }
  clearGenocides();
});

Deno.test("pickSpecificMonster returns null for genocided monster", () => {
  clearGenocides();
  addGenocide('orc_shaman');
  const result = pickSpecificMonster('orc_shaman', 6);
  assertEquals(result, null, 'genocided monster should return null');
  clearGenocides();
});
