// rules/data/classes.js
// Player class definitions. Pure data — no behavior, no display.

export const CLASS_DEFS = {
  druid: {
    id: 'druid',
    name: 'Druid',
    description: 'A guardian of nature. Communes with the wild, heals the wounded.',
    deityId: 'gaia',
    stats: {
      maxHp: 18,
      maxMana: 70,
      manaRegen: 0.15,
      maxStamina: 80,
      staminaRegen: 2.25,
      intelligence: 12,
      visionRange: 12,
    },
    equipment: {
      weapon: 'staff_oak',
      armor: 'leather_armor',
      shield: null,
      feet: 'sandals_hemp',
    },
    inventoryItems: [
      { itemId: 'potion_health', count: 2 },
    ],
    startingSpell: 'frost',
  },

  warden: {
    id: 'warden',
    name: 'Warden',
    description: 'A brute devoted to slaughter. Every kill is an offering.',
    deityId: 'molkhar',
    stats: {
      maxHp: 26,
      maxMana: 20,
      manaRegen: 0.05,
      maxStamina: 130,
      staminaRegen: 3.75,
      intelligence: 6,
      visionRange: 8,
    },
    equipment: {
      weapon: 'axe_heavy',
      armor: 'leather_armor',
      shield: null,
      feet: 'boots_leather',
    },
    inventoryItems: [
      { itemId: 'potion_health', count: 1 },
    ],
    startingSpell: null,
  },

  outlaw: {
    id: 'outlaw',
    name: 'Outlaw',
    description: 'Quick, slippery, unreliable. Loki loves a good con.',
    deityId: 'loki',
    stats: {
      maxHp: 16,
      maxMana: 35,
      manaRegen: 0.12,
      maxStamina: 110,
      staminaRegen: 3.3,
      intelligence: 10,
      visionRange: 10,
    },
    equipment: {
      weapon: 'dagger_quick',
      armor: null,
      shield: null,
      feet: 'boots_leather',

    },
    inventoryItems: [
      { itemId: 'potion_health', count: 1 },
      { itemId: 'scroll_blastwave', count: 1 },
      { itemId: 'potion_poison', count: 2 },
    ],
    startingSpell: 'phase_strike',
  },

  cleric: {
    id: 'cleric',
    name: 'Cleric',
    description: 'Devoted to Seraphine. Shields the faithful, smites the wicked.',
    deityId: 'seraphine',
    stats: {
      maxHp: 20,
      maxMana: 55,
      manaRegen: 0.13,
      maxStamina: 90,
      staminaRegen: 2.7,
      intelligence: 10,
      visionRange: 10,
    },
    equipment: {
      weapon: 'iron_mace',
      armor: 'leather_armor',
      shield: 'shield_wood',
      feet: 'shoes_cloth',
    },
    inventoryItems: [
      { itemId: 'potion_health', count: 2 },
      { itemId: 'potion_holy_water', count: 1 },
    ],
    startingSpell: 'flash_heal',
  },
};

/** @param {string} id */
export function getClass(id) {
  return CLASS_DEFS[id] ?? null;
}

/** @returns {string[]} */
export function listClassIds() {
  return Object.keys(CLASS_DEFS);
}
