// rules/environment/dungeon/tables.js
// Loot tables and monster pools for depth-scaled entity placement.

import { getMonstersByTier } from '../../data/monsters.js';

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
  };
}

/** Equipment IDs by rarity tier. */
const EQUIP_COMMON = [
  'sword_plain', 'dagger_quick', 'leather_armor', 'shield_wood',
];
const EQUIP_MAGIC = [
  'axe_heavy', 'chain_armor', 'ring_health', 'ring_precision', 'shield_iron',
];

/**
 * Pick an item spawn descriptor.
 * @param {Object} rng
 * @param {number} depth
 * @returns {{kind:string, count?:number, equipId?:string}}
 */
export function pickItem(rng, depth) {
  const roll = rng.next();
  if (roll < 0.40) {
    return { kind: 'gold', count: rng.int(5 + depth * 2, 15 + depth * 5) };
  }
  if (roll < 0.70) {
    return { kind: 'potion' };
  }
  if (roll < 0.90) {
    const pool = depth >= 5 ? EQUIP_MAGIC : EQUIP_COMMON;
    return { kind: 'equipment', equipId: rng.choice(pool) };
  }
  return { kind: 'potion' }; // scrolls not yet implemented, fallback to potion
}
