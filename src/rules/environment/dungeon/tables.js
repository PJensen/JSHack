// rules/environment/dungeon/tables.js
// Loot tables and monster pools for depth-scaled entity placement.

import { getMonstersByTier } from '../../data/monsters.js';
import { resolveLootTable } from '../../data/lootResolver.js';

/**
 * Pick monster parameters based on depth.
 * @param {Object} rng - createRng() instance
 * @param {number} depth
 */
export function pickMonster(rng, depth) {
  const tier = Math.min(Math.floor((depth - 1) / 5), 3);
  const pool = getMonstersByTier(tier);
  const t = rng.choice(pool);
  return {
    name: t.name,
    identity: t.id,
    maxHp: Math.floor(t.baseHp + depth * t.hpPerLevel),
    faction: 'enemy',
    attackDerived: t.attack,
    defenseDerived: t.defense,
    naturalDamageDice: t.damageDice,
    sizeClass: t.sizeClass,
    massKg: t.massKg,
    resistances: t.resistances,
    speed: t.speed,
    naturalScript: t.script,
  };
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
  // Snake traps appear from depth 6+ (tier 1), increasing in likelihood
  if (depth >= 6 && rng.next() < Math.min(0.4, 0.1 + depth * 0.03)) {
    const count = Math.min(5, 2 + Math.floor(depth / 5));
    return { type: 'snake', script: 'trap_snake', params: { count } };
  }
  // Spike damage: 15% at shallow depths, up to 35% deep
  const percent = Math.min(0.35, 0.15 + depth * 0.02);
  return { type: 'spike', script: 'trap_spike', params: { percent } };
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
  // Get base monster using existing pickMonster logic
  const monsterParams = pickMonster(rng, depth);

  // Look up pack size based on monster's size class
  const packRange = PACK_SIZE_BY_CLASS[monsterParams.sizeClass] || PACK_SIZE_BY_CLASS['M'];
  const packSize = rng.int(packRange.min, packRange.max);

  return {
    monsterType: monsterParams,
    packSize: packSize,
    depth: depth,
  };
}
