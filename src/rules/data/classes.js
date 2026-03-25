// rules/data/classes.js
// Player class definitions. Pure data — no behavior, no display.

export const CLASS_DEFS = {
  warden: {
    id: 'warden',
    name: 'Warden',
    description: 'A brute devoted to slaughter. Every kill is an offering.',
    deityId: 'molkhar',
    stats: {
      maxHp: 33,
      maxMana: 20,
      manaRegen: 0.05,
      maxStamina: 130,
      staminaRegen: 3.75,
      intelligence: 6,
      dexterity: 12,
      visionRange: 8,
    },
    equipment: {
      weapon: 'axe_heavy',
      armor: 'leather_armor',
      offhand: null,
      feet: 'boots_leather',
    },
    inventoryItems: [
      { itemId: 'hearthstone', count: 1 },
      { itemId: 'potion_health', count: 2 },
      { itemId: 'potion_mana', count: 3 },
      { itemId: 'scroll_identify', count: 4 },
    ],
    startingSpells: ['rampage', 'earthshatter'],
  },

  druid: {
    id: 'druid',
    name: 'Druid',
    description: 'A guardian of nature. Communes with the wild, heals the wounded.',
    deityId: 'gaia',
    stats: {
      maxHp: 23,
      maxMana: 70,
      manaRegen: 0.15,
      maxStamina: 80,
      staminaRegen: 2.25,
      intelligence: 12,
      dexterity: 14,
      visionRange: 8,
    },
    equipment: {
      weapon: 'staff_oak',
      armor: 'leather_armor',
      offhand: null,
      feet: 'sandals_hemp',
    },
    inventoryItems: [
      { itemId: 'hearthstone', count: 1 },
      { itemId: 'potion_health', count: 2 },
      { itemId: 'potion_mana', count: 3 },
      { itemId: 'scroll_identify', count: 4 },
    ],
    startingSpells: ['frost', 'blizzard', 'harmony_ward'],
  },

  outlaw: {
    id: 'outlaw',
    name: 'Outlaw',
    description: 'Quick, slippery, unreliable. Loki loves a good con.',
    deityId: 'loki',
    stats: {
      maxHp: 20,
      maxMana: 35,
      manaRegen: 0.12,
      maxStamina: 110,
      staminaRegen: 3.3,
      intelligence: 10,
      dexterity: 16,
      visionRange: 8,
      perception: 7,
    },
    equipment: {
      weapon: 'dagger_quick',
      armor: null,
      offhand: null,
      feet: 'boots_leather',
      ranged: 'bow_short',
      ammo: 'ammo_arrows',
    },
    inventoryItems: [
      { itemId: 'hearthstone', count: 1 },
      { itemId: 'potion_health', count: 2 },
      { itemId: 'potion_mana', count: 3 },
      { itemId: 'scroll_blastwave', count: 1 },
      { itemId: 'potion_poison', count: 2 },
      { itemId: 'scroll_identify', count: 4 },
      { itemId: 'ammo_arrows', count: 1 },
      { itemId: 'ammo_blunt_arrows', count: 1 },
      { itemId: 'ammo_fire_arrows', count: 1 }
    ],
    startingSpells: ['phase_strike', 'blind', 'shadow_veil'],
  },

  archeologist: {
    id: 'archeologist',
    name: 'Archeologist',
    description: 'A scholar of ruins. Digs deep, identifies relics, and trusts in luck.',
    deityId: 'gaia',
    stats: {
      maxHp: 22,
      maxMana: 30,
      manaRegen: 0.08,
      maxStamina: 100,
      staminaRegen: 3.0,
      intelligence: 11,
      dexterity: 16,
      visionRange: 8,
    },
    equipment: {
      weapon: 'iron_pickaxe',
      armor: null,
      offhand: null,
      neck: 'pendant_lucky',
      feet: 'boots_leather',
    },
    inventoryItems: [
      { itemId: 'hearthstone', count: 1 },
      { itemId: 'potion_health', count: 2 },
      { itemId: 'potion_mana', count: 3 },
      { itemId: 'stone_touchstone', count: 1 },
      { itemId: 'potion_anti_venom', count: 2 },
      { itemId: 'scroll_identify', count: 4 },
    ],
    startingSpell: null,
  },

  warlock: {
    id: 'warlock',
    name: 'Warlock',
    description: 'A dark conjurer bound to forces beyond the veil. Commands the dead and channels hellfire through a familiar.',
    deityId: 'molkhar',
    stats: {
      maxHp: 22,
      maxMana: 65,
      manaRegen: 0.14,
      maxStamina: 75,
      staminaRegen: 2.0,
      intelligence: 13,
      dexterity: 12,
      visionRange: 8,
    },
    equipment: {
      weapon: 'staff_oak',
      armor: null,
      offhand: null,
      gloves: 'gloves_arcane',
      feet: 'shoes_cloth',
    },
    inventoryItems: [
      { itemId: 'hearthstone', count: 1 },
      { itemId: 'potion_health', count: 2 },
      { itemId: 'potion_mana', count: 3 },
      { itemId: 'scroll_identify', count: 4 },
    ],
    startingSpells: ['shadow_bolt','summon_skeleton','agony','drain_life'],
  },

  cleric: {
    id: 'cleric',
    name: 'Cleric',
    description: 'Devoted to Seraphine. Shields the faithful, smites the wicked.',
    deityId: 'seraphine',
    stats: {
      maxHp: 25,
      maxMana: 55,
      manaRegen: 0.13,
      maxStamina: 90,
      staminaRegen: 2.7,
      intelligence: 10,
      dexterity: 12,
      visionRange: 8,
    },
    equipment: {
      weapon: 'iron_mace',
      armor: 'leather_armor',
      offhand: 'shield_wood',
      feet: 'shoes_cloth',
    },
    inventoryItems: [
      { itemId: 'hearthstone', count: 1 },
      { itemId: 'potion_health', count: 2 },
      { itemId: 'potion_mana', count: 3 },
      { itemId: 'potion_holy_water', count: 1 },
      { itemId: 'scroll_identify', count: 4 },
    ],
    startingSpells: ['smite', 'flash_heal'],
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
