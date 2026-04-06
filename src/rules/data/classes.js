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
      visionRange: 6,
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
    // Rotation: Generator → Buff → Core → Utility → Finisher
    startingSpells: [
      'savage_strike',   // 🦬 generator: free melee, +20 stamina
      'iron_flesh',      // 💪 buff: +4 AC, thorns, slowed
      'bloodthirst',     // sustain buff: 25% lifesteal on hit
      'cleave',          // AoE melee damage
      'war_cry',         // AoE debuff: weaken nearby
      'earthshatter',    // AoE stun + ground hazard
      'rampage',         // finisher: berserk 100 turns (all mana)
    ],
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
      visionRange: 6,
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
    // Rotation: Generator → Buff → Core → CC → Sustain
    startingSpells: [
      'natures_touch',   // 🌿 generator: free ranged, +8 mana
      'barkskin',        // 🌳 buff: +2 AC, thorns, regen
      'thorn_burst',     // 🥀 AoE burst from caster
      'entangle',        // 🔗 CC: targeted stun + poison
      'heal',            // single-target heal
      'verdant_ward',    // sustain: regen + stoneskin + vision
      'harmony_ward',    // resist all elements
    ],
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
      visionRange: 6,
      perception: 7,
    },
    equipment: {
      weapon: 'dagger_quick',
      armor: 'leather_armor',
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
    // Rotation: Generator → Buff → Engage → CC → Utility
    startingSpells: [
      'cheap_shot',      // 👊 generator: free melee, +10 mana
      'quicken',         // ⚡ buff: +crit, +attack, +stam regen
      'phase_strike',    // engage: teleport-slash along path
      'poison_blade',    // utility: coat weapon in venom
      'blind',           // CC: blind target
      'shadow_veil',     // stealth: invisible + phase + crit
      'smoke_bomb',      // escape: AoE blind + disengage
    ],
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
      visionRange: 6,
    },
    equipment: {
      weapon: 'iron_pickaxe',
      armor: 'leather_armor',
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
      visionRange: 6,
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
    // Rotation: Generator(lifetap) → Debuff → DoT → Core → Sustain → Summon
    startingSpells: [
      'lifetap',         // generator: sacrifice HP → mana
      'mark_of_death',   // 💀 debuff: target takes +35% damage
      'agony',           // DoT: shadow damage over time
      'shadow_bolt',     // core ranged damage
      'drain_life',      // sustain: channel life siphon
      'summon_skeleton',  // summon: skeleton minion
    ],
  },

  mage: {
    id: 'mage',
    name: 'Mage',
    description: 'Pure elemental destruction. Glass cannon — lowest HP, highest mana.',
    deityId: 'loki',
    stats: {
      maxHp: 18,
      maxMana: 75,
      manaRegen: 0.16,
      maxStamina: 70,
      staminaRegen: 1.8,
      intelligence: 15,
      dexterity: 11,
      visionRange: 6,
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
    // Rotation: Generator → Buff → Core → Core → AoE → Finisher
    startingSpells: [
      'arcane_bolt',     // ✴️ generator: free ranged, +6 mana
      'ignite_weapons',  // 🔥 buff: +3 fire per hit, burn proc
      'fireball',        // core: fire projectile
      'frost',           // core: frost projectile + slow
      'firestorm',       // AoE: sustained fire rain (channel)
      'blizzard',        // AoE: sustained frost rain (channel)
      'meteor',          // finisher: massive AoE nuke
    ],
  },

  mireborn: {
    id: 'mireborn',
    name: 'Mireborn',
    description: 'Swamp-born and thick-skinned. Poisons, entangles, and outlasts.',
    deityId: 'gaia',
    stats: {
      maxHp: 28,
      maxMana: 35,
      manaRegen: 0.08,
      maxStamina: 100,
      staminaRegen: 3.0,
      intelligence: 9,
      dexterity: 13,
      visionRange: 6,
    },
    equipment: {
      weapon: 'morningstar',
      armor: 'leather_armor',
      offhand: null,
      feet: 'boots_leather',
    },
    inventoryItems: [
      { itemId: 'hearthstone', count: 1 },
      { itemId: 'potion_health', count: 2 },
      { itemId: 'potion_mana', count: 3 },
      { itemId: 'potion_anti_venom', count: 2 },
      { itemId: 'scroll_identify', count: 4 },
    ],
    // Rotation: Generator → Buff → Core → CC → Sustain → DoT
    startingSpells: [
      'leech_spores',    // 🍄 generator: free ranged, +6 mana +10 stam
      'primal_roar',     // 🦁 buff: berserk + fury + stagger nearby
      'thorn_burst',     // 🥀 AoE burst from caster
      'entangle',        // 🔗 CC: targeted stun + poison
      'poison_blade',    // utility: coat weapon in venom
      'verdant_ward',    // sustain: regen + stoneskin + vision
      'plague_swarm',    // DoT: jumping plague
    ],
  },

  pilgrim: {
    id: 'pilgrim',
    name: 'Pilgrim',
    description: 'Wandering ascetic. Starts with almost nothing — rewards exploration and patience.',
    deityId: 'seraphine',
    stats: {
      maxHp: 19,
      maxMana: 45,
      manaRegen: 0.18,
      maxStamina: 90,
      staminaRegen: 2.5,
      intelligence: 11,
      dexterity: 12,
      visionRange: 6,
      perception: 8,
    },
    equipment: {
      weapon: 'staff_oak',
      armor: null,
      offhand: null,
      feet: 'sandals_hemp',
    },
    inventoryItems: [
      { itemId: 'hearthstone', count: 1 },
      { itemId: 'potion_health', count: 2 },
      { itemId: 'potion_mana', count: 3 },
      { itemId: 'scroll_identify', count: 4 },
    ],
    startingSpells: ['flash_heal', 'blink', 'homecoming'],
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
      visionRange: 6,
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
    // Rotation: Generator → Buff → Core → Heal → Cleanse → Finisher
    startingSpells: [
      'holy_strike',     // ☀️ generator: free melee, +8 mana
      'divine_shield',   // buff: stoneskin + shield + blessed
      'smite',           // core: ranged holy damage
      'flash_heal',      // heal: instant self-heal + adjacent holy damage
      'purify',          // cleanse: remove all debuffs
      'consecrate',      // finisher: AoE holy damage + heal
    ],
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
