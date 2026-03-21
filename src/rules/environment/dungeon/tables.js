// rules/environment/dungeon/tables.js
// Loot tables and monster pools for depth-scaled entity placement.

import { getMonster, getMonstersByTier, isGenocided } from '../../data/monsters.js';
import { resolveLootTable } from '../../data/lootResolver.js';
import { creatureTypeFromTags } from '../../components/CreatureType.js';

/**
 * Convert a monster definition into spawn-time params.
 * @param {import('../../data/monsters.js').MonsterDef} def
 * @param {number} depth
 */
function toMonsterSpawnParams(def, depth) {
  return {
    name: def.name,
    identity: def.id,
    maxHp: Math.floor(def.baseHp + depth * def.hpPerLevel),
    faction: 'enemy',
    accuracyDerived: def.attack,
    damagePowerDerived: def.attack,
    evadeDerived: def.defense,
    naturalDamageDice: def.damageDice,
    sizeClass: def.sizeClass,
    massKg: def.massKg,
    resistances: def.resistances,
    speed: def.speed,
    equipment: def.equipment || null,
    learnedSpellIds: Array.isArray(def.learnedSpellIds) ? [...def.learnedSpellIds] : [],
    maxMana: Number.isFinite(def.maxMana) ? Number(def.maxMana) : 0,
    manaRegen: Number.isFinite(def.manaRegen) ? Number(def.manaRegen) : 0,
    creatureType: creatureTypeFromTags(def.tags || []),
  };
}

/**
 * Pick monster parameters based on depth.
 * @param {Object} rng - createRng() instance
 * @param {number} depth
 */
export function pickMonster(rng, depth, monsterFilter = null) {
  const tier = Math.min(Math.floor((depth - 1) / 5), 3);
  let pool = getMonstersByTier(tier);
  if (monsterFilter) {
    const filtered = pool.filter(monsterFilter);
    if (filtered.length > 0) pool = filtered;
  }
  let def = rng.choice(pool);

  // Rare upgrade: cave_snake or cave_spider has a 5% chance to become a pit viper
  if ((def.id === 'cave_snake' || def.id === 'cave_spider') && rng.next() < 0.05) {
    const rare = getMonster('pit_viper');
    if (rare && !isGenocided('pit_viper')) def = rare;
  }

  // Rare upgrade: rat has a 3% chance to become a cave bear
  if (def.id === 'rat' && rng.next() < 0.03) {
    const rare = getMonster('cave_bear');
    if (rare && !isGenocided('cave_bear')) def = rare;
  }

  // Rare upgrade: bat has a 2% chance to be an early dragon sighting.
  if (def.id === 'bat' && rng.next() < 0.02) {
    const rare = getMonster('dragon_whelp');
    if (rare && !isGenocided('dragon_whelp')) def = rare;
  }

  return toMonsterSpawnParams(def, depth);
}

/**
 * Pick a monster with a chance to draw from the next tier up (sentinel).
 * The sentinel roll is always consumed to keep the RNG sequence stable.
 * @param {Object} rng
 * @param {number} depth
 * @param {Function|null} monsterFilter
 * @returns {Object}
 */
export function pickSentinelMonster(rng, depth, monsterFilter = null) {
  const sentinelRoll = rng.next();
  const tier = Math.min(Math.floor((depth - 1) / 5), 3);
  if (tier < 3 && sentinelRoll < 0.10) {
    // Bump to next tier boundary for the pick, keeping original depth for HP calc
    const sentinelDepth = (tier + 1) * 5 + 1;
    return pickMonster(rng, sentinelDepth, monsterFilter);
  }
  return pickMonster(rng, depth, monsterFilter);
}

/**
 * Pick an item spawn descriptor via the loot table system.
 * Returns a materializeSpawn-compatible descriptor: {kind, count?, equipId?}
 * @param {Object} rng
 * @param {number} depth
 * @returns {{kind:string, count?:number, equipId?:string}}
 */
export function pickItem(rng, depth) {
  const tableId = depth >= 8 ? 'floor:magic' : 'floor:common';
  const drops = resolveLootTable(tableId, rng, depth);
  if (drops.length === 0) return { kind: 'potion' };

  // Convert first resolved drop to the spawn descriptor format
  const drop = drops[0];
  switch (drop.kind) {
    case 'gold':
      return { kind: 'gold', count: drop.params.count };
    case 'equip':
      return { kind: 'equipment', equipId: drop.params.equipId, affixes: drop.params.affixes };
    case 'archetype':
      if (drop.params.archetype === 'HealthPotion') return { kind: 'potion' };
      if (drop.params.archetype === 'ArrowsStack') return { kind: 'arrows' };
      if (drop.params.archetype === 'FireArrowsStack') return { kind: 'fire_arrows' };
      if (drop.params.archetype === 'ScrollOfMapping') return { kind: 'scroll' };
      return { kind: 'potion' };
    case 'item':
      return { kind: 'book', bookId: drop.params.itemId };
    default:
      return { kind: 'potion' };
  }
}

/**
 * Pick a trap descriptor based on depth.
 * @param {Object} rng
 * @param {number} depth
 * @returns {{type:string, script:string, params:Object}}
 */
export function pickTrap(rng, depth) {
  const roll = rng.next();
  // Snake traps: 25% chance, snake count scales with depth
  if (roll < 0.25) {
    const count = Math.min(6, 3 + Math.floor(depth / 4));
    return { type: 'snake', script: 'trap_snake', params: { count } };
  }
  // Shock traps: 30% chance
  if (roll < 0.55) {
    return { type: 'shock', script: 'trap_shock', params: { percent: 0.30 } };
  }
  // Spike traps: remaining 45%
  return { type: 'spike', script: 'trap_spike', params: { percent: 0.50 } };
}

// Pack size by monster size class - how many monsters to spawn per pack
const PACK_SIZE_BY_CLASS = {
  'XS': { min: 3, max: 6 },   // tiny creatures - swarms
  'S':  { min: 2, max: 5 },   // small creatures - groups
  'M':  { min: 1, max: 3 },   // medium creatures - pairs/trios
  'L':  { min: 1, max: 2 },   // large creatures - rare pairs
  'XL': { min: 1, max: 1 },   // gigantic creatures - never pack
};

// Spawner profiles by size class — controls concurrent/total/cooldown variety.
// XS: lone trickle nests that keep producing over time (1 concurrent, high total)
// S:  swarm nests that burst several at once but exhaust faster (2-3 concurrent, lower total)
const SPAWNER_PROFILE_BY_CLASS = {
  'XS': { concurrent: { min: 1, max: 2 }, total: { min: 6, max: 10 }, cooldown: 12 },
  'S':  { concurrent: { min: 2, max: 3 }, total: { min: 3, max: 5 },  cooldown: 15 },
  'M':  { concurrent: { min: 1, max: 2 }, total: { min: 4, max: 6 },  cooldown: 20 },
  'L':  { concurrent: { min: 1, max: 1 }, total: { min: 2, max: 3 },  cooldown: 25 },
  'XL': { concurrent: { min: 1, max: 1 }, total: { min: 1, max: 2 },  cooldown: 80 },
};

const SPAWNER_WHITELIST_MONSTER_IDS = new Set([
  'rat',
  'bat',
  'cave_spider',
  'spider',
  'cave_snake',
  'snake',
  'cave_bear',
]);

function isSpawnerEligibleMonster(def) {
  return !!def && SPAWNER_WHITELIST_MONSTER_IDS.has(def.id);
}

/**
 * Create spawn params for a specific monster by ID.
 * @param {string} monsterId
 * @param {number} depth
 * @returns {Object|null}
 */
export function pickSpecificMonster(monsterId, depth) {
  const def = getMonster(monsterId);
  if (!def || isGenocided(monsterId)) return null;
  return toMonsterSpawnParams(def, depth);
}

/**
 * Create a spawner for a specific monster type.
 * @param {Object} rng
 * @param {string} monsterId
 * @param {number} depth
 * @returns {Object|null}
 */
export function pickSpecificSpawner(rng, monsterId, depth) {
  const params = pickSpecificMonster(monsterId, depth);
  if (!params || !isSpawnerEligibleMonster({ id: params.identity })) return null;
  const profile = SPAWNER_PROFILE_BY_CLASS[params.sizeClass] || SPAWNER_PROFILE_BY_CLASS['M'];
  const totalToSpawn = rng.int(profile.total.min, profile.total.max);
  const maxConcurrent = rng.int(profile.concurrent.min, profile.concurrent.max);
  return { monsterType: params, packSize: totalToSpawn, maxConcurrent, cooldownTicks: profile.cooldown, depth };
}

/**
 * Pick spawner parameters based on depth.
 * @param {Object} rng - createRng() instance
 * @param {number} depth
 * @returns {{monsterType:Object, packSize:number, depth:number}}
 */
export function pickSpawner(rng, depth, monsterFilter = null) {
  // Spawners use the same tier-based pool as individual monsters,
  // with a narrow eligibility gate for non-nesting creatures.
  const spawnerFilter = (def) => {
    if (!isSpawnerEligibleMonster(def)) return false;
    return monsterFilter ? monsterFilter(def) : true;
  };
  const monsterParams = pickMonster(rng, depth, spawnerFilter);

  // Look up spawner profile based on monster's size class
  const profile = SPAWNER_PROFILE_BY_CLASS[monsterParams.sizeClass] || SPAWNER_PROFILE_BY_CLASS['M'];
  const totalToSpawn = rng.int(profile.total.min, profile.total.max);
  const maxConcurrent = rng.int(profile.concurrent.min, profile.concurrent.max);

  return {
    monsterType: monsterParams,
    packSize: totalToSpawn,
    maxConcurrent,
    cooldownTicks: profile.cooldown,
    depth: depth,
  };
}

// ── Encounter Groups ────────────────────────────────────────────────
// Themed monster compositions that replace random individual picks.
// Each template defines a leader + followers drawn from the room's budget.

const ENCOUNTER_GROUPS = [
  // Tier 0
  { tier: 0, leader: 'kobold_shaman', followers: [{ id: 'goblin', count: 2 }], minBudget: 3 },
  { tier: 0, leader: 'skeleton_archer', followers: [{ id: 'rat', count: 2 }], minBudget: 3 },
  { tier: 0, leader: 'goblin_archer', followers: [{ id: 'goblin', count: 2 }], minBudget: 3 },
  { tier: 0, leader: 'skeletal_shadow_caster', followers: [{ id: 'skeleton_archer', count: 1 }], minBudget: 2 },
  { tier: 0, leader: null, followers: [{ id: 'cave_spider', count: 3 }], minBudget: 3 },
  { tier: 0, leader: null, followers: [{ id: 'centipede', count: 2 }], minBudget: 2 },

  // Tier 1
  { tier: 1, leader: 'orc_shaman', followers: [{ id: 'orc', count: 2 }], minBudget: 3 },
  { tier: 1, leader: 'wight', followers: [{ id: 'skeleton', count: 2 }], minBudget: 3 },
  { tier: 1, leader: 'hobgoblin', followers: [{ id: 'orc', count: 1 }, { id: 'bone_bowman', count: 1 }], minBudget: 3 },
  { tier: 1, leader: 'orc_shaman', followers: [{ id: 'hobgoblin', count: 1 }], minBudget: 2 },
  { tier: 1, leader: null, followers: [{ id: 'phase_spider', count: 2 }], minBudget: 2 },

  // Tier 2
  { tier: 2, leader: 'orc_warchief', followers: [{ id: 'orc', count: 2 }], minBudget: 3 },
  { tier: 2, leader: 'dark_acolyte', followers: [{ id: 'wraith', count: 1 }], minBudget: 2 },
  { tier: 2, leader: 'dark_acolyte', followers: [{ id: 'skeleton', count: 2 }], minBudget: 3 },
  { tier: 2, leader: 'troll', followers: [{ id: 'ogre', count: 1 }], minBudget: 2 },

  // Tier 3
  { tier: 3, leader: 'lich', followers: [{ id: 'wraith', count: 1 }, { id: 'skeleton', count: 1 }], minBudget: 3 },
  { tier: 3, leader: 'demon', followers: [{ id: 'death_archer', count: 1 }], minBudget: 2 },
];

/**
 * Try to pick an encounter group for the given depth and budget.
 * Returns null if no group fits or the roll doesn't fire.
 * @param {Object} rng
 * @param {number} depth
 * @param {number} budget
 * @returns {{ leader: Object|null, followers: Object[] } | null}
 */
export function pickEncounterGroup(rng, depth, budget) {
  const tier = Math.min(Math.floor((depth - 1) / 5), 3);
  const eligible = ENCOUNTER_GROUPS.filter(g =>
    g.tier === tier && budget >= g.minBudget
  );
  if (eligible.length === 0) return null;

  const group = rng.choice(eligible);
  const result = { leader: null, followers: [] };

  if (group.leader) {
    const leaderParams = pickSpecificMonster(group.leader, depth);
    if (!leaderParams) return null; // genocided
    result.leader = leaderParams;
  }

  for (const f of group.followers) {
    for (let i = 0; i < f.count; i++) {
      const params = pickSpecificMonster(f.id, depth);
      if (params) result.followers.push(params);
    }
  }

  return result;
}
