// rules/environment/dungeon/tables.js
// Loot tables and monster pools for depth-scaled entity placement.

/**
 * @typedef {Object} MonsterTemplate
 * @property {string} name
 * @property {string} identity
 * @property {number} baseHp
 * @property {number} hpPerLevel
 */

/** @type {MonsterTemplate[][]} */
const MONSTER_TIERS = [
  // Tier 0 (floors 1-5)
  [
    { name: 'Rat', identity: 'monster', baseHp: 5, hpPerLevel: 1 },
    { name: 'Goblin', identity: 'monster', baseHp: 8, hpPerLevel: 1.5 },
    { name: 'Bat', identity: 'monster', baseHp: 3, hpPerLevel: 0.5 },
  ],
  // Tier 1 (floors 6-10)
  [
    { name: 'Orc', identity: 'monster', baseHp: 15, hpPerLevel: 2 },
    { name: 'Skeleton', identity: 'monster', baseHp: 12, hpPerLevel: 1.8 },
    { name: 'Spider', identity: 'monster', baseHp: 10, hpPerLevel: 1.5 },
  ],
  // Tier 2 (floors 11-15)
  [
    { name: 'Troll', identity: 'monster', baseHp: 25, hpPerLevel: 3 },
    { name: 'Wraith', identity: 'monster', baseHp: 18, hpPerLevel: 2.5 },
    { name: 'Ogre', identity: 'monster', baseHp: 30, hpPerLevel: 2 },
  ],
  // Tier 3 (floors 16+)
  [
    { name: 'Demon', identity: 'monster', baseHp: 40, hpPerLevel: 4 },
    { name: 'Dragon', identity: 'monster', baseHp: 50, hpPerLevel: 5 },
    { name: 'Lich', identity: 'monster', baseHp: 35, hpPerLevel: 3.5 },
  ],
];

/**
 * Pick monster parameters based on depth.
 * @param {Object} rng - createRng() instance
 * @param {number} depth
 * @returns {{name:string, identity:string, maxHp:number, faction:string}}
 */
export function pickMonster(rng, depth) {
  const tier = Math.min(Math.floor((depth - 1) / 5), MONSTER_TIERS.length - 1);
  const pool = MONSTER_TIERS[tier];
  const template = rng.choice(pool);
  return {
    name: template.name,
    identity: template.identity,
    maxHp: Math.floor(template.baseHp + depth * template.hpPerLevel),
    faction: 'enemy',
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
