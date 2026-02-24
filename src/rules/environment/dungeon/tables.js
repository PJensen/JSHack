// rules/environment/dungeon/tables.js
// Loot tables and monster pools for depth-scaled entity placement.

import { getMonster, getMonstersByTier } from '../../data/monsters.js';
import { resolveLootTable } from '../../data/lootResolver.js';

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
  };
}

/**
 * Pick monster parameters based on depth.
 * @param {Object} rng - createRng() instance
 * @param {number} depth
 */
export function pickMonster(rng, depth) {
  const tier = Math.min(Math.floor((depth - 1) / 5), 3);
  const pool = getMonstersByTier(tier);
  const def = rng.choice(pool);
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
 * Pick spawner parameters based on depth.
 * Returns spawner config with monster type and pack size.
 * @param {Object} rng - createRng() instance
 * @param {number} depth
 * @returns {{monsterType:Object, packSize:number, depth:number}}
 */
export function pickSpawner(rng, depth) {
  // Early-game nests are small vermin packs: rats or spiders.
  // This keeps early spawners readable and dangerous without front-loading heavy monsters.
  let monsterParams = null;
  if (depth <= 5) {
    const earlyPool = ['rat', 'spider']
      .map((id) => getMonster(id))
      .filter(Boolean);
    if (earlyPool.length > 0) {
      monsterParams = toMonsterSpawnParams(rng.choice(earlyPool), depth);
    }
  }
  if (!monsterParams) monsterParams = pickMonster(rng, depth);

  // Look up pack size based on monster's size class
  const packRange = PACK_SIZE_BY_CLASS[monsterParams.sizeClass] || PACK_SIZE_BY_CLASS['M'];
  const packSize = rng.int(packRange.min, packRange.max);

  return {
    monsterType: monsterParams,
    packSize: packSize,
    depth: depth,
  };
}
