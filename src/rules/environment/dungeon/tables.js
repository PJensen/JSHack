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
    attackDerived: def.attack,
    defenseDerived: def.defense,
    naturalDamageDice: def.damageDice,
    sizeClass: def.sizeClass,
    massKg: def.massKg,
    resistances: def.resistances,
    speed: def.speed,
    equipment: def.equipment || null,
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
  if (!params) return null;
  const packRange = PACK_SIZE_BY_CLASS[params.sizeClass] || PACK_SIZE_BY_CLASS['M'];
  const packSize = rng.int(packRange.min, packRange.max);
  return { monsterType: params, packSize, depth };
}

/**
 * Pick spawner parameters based on depth.
 * @param {Object} rng - createRng() instance
 * @param {number} depth
 * @returns {{monsterType:Object, packSize:number, depth:number}}
 */
export function pickSpawner(rng, depth, monsterFilter = null) {
  // Spawners use the same tier-based pool as individual monsters.
  const monsterParams = pickMonster(rng, depth, monsterFilter);

  // Look up pack size based on monster's size class
  const packRange = PACK_SIZE_BY_CLASS[monsterParams.sizeClass] || PACK_SIZE_BY_CLASS['M'];
  const packSize = rng.int(packRange.min, packRange.max);

  return {
    monsterType: monsterParams,
    packSize: packSize,
    depth: depth,
  };
}
