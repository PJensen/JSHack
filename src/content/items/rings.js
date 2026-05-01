// src/content/items/rings.js
// All slot:ring definitions migrated from itemCatalogEquipment.js.

import { defineItem } from '../define.js';

defineItem('ring_copper', {
  name: 'Copper Ring', type: 'ring',
  glyph: '◌', color: '#c87a3a', glow: '#8a5020', scale: 0.45,
  material: 'copper', rarity: 1,
  bonuses: { defense: 1 },
  weight: 0.05,
  description: 'A simple hammered copper band, green with patina.',
});

defineItem('ring_bone', {
  name: 'Bone Ring', type: 'ring',
  glyph: '◌', color: '#d8d0c0', glow: '#a8a090', scale: 0.45,
  material: 'bone', rarity: 1,
  bonuses: { maxHp: 3 },
  weight: 0.03,
  description: 'Carved from a knuckle bone. It carries a faint warmth.',
});

defineItem('ring_health', {
  name: 'Ring of Health', type: 'ring',
  glyph: '◌', color: '#ffb347', glow: '#ffb347', scale: 0.45,
  material: 'gold', rarity: 2,
  bonuses: { maxHp: 5 },
  weight: 0.06,
});

defineItem('ring_precision', {
  name: 'Ring of Precision', type: 'ring',
  glyph: '◌', color: '#b3e6ff', glow: '#b3e6ff', scale: 0.45,
  material: 'silver', rarity: 2,
  bonuses: { dexterity: 1, critChance: 0.08 },
  weight: 0.05,
});

defineItem('ring_arcana', {
  name: 'Ring of Arcana', type: 'ring',
  glyph: '◌', color: '#a480ff', glow: '#a480ff', scale: 0.45,
  material: 'silver', rarity: 3,
  bonuses: { manaRegen: 0.5, spellHit: 1 },
  weight: 0.05,
});

defineItem('ring_fire_resist', {
  name: 'Ring of Fire Resistance', type: 'ring',
  glyph: '◌', color: '#ff9a5c', glow: '#ff6f2e', scale: 0.45,
  material: 'gold', rarity: 2,
  bonuses: { fireResist: 0.3 },
  weight: 0.06,
});

defineItem('ring_poison_resist', {
  name: 'Ring of Poison Resistance', type: 'ring',
  glyph: '◌', color: '#9bdc7a', glow: '#6ca84f', scale: 0.45,
  material: 'silver', rarity: 2,
  bonuses: { poisonResist: 0.3 },
  weight: 0.05,
});

defineItem('ring_cold_resist', {
  name: 'Ring of Cold Resistance', type: 'ring',
  glyph: '◌', color: '#7ec8e3', glow: '#4a9ec0', scale: 0.45,
  material: 'silver', rarity: 2,
  bonuses: { coldResist: 0.3 },
  weight: 0.05,
});

defineItem('ring_shock_resist', {
  name: 'Ring of Shock Resistance', type: 'ring',
  glyph: '◌', color: '#ffe066', glow: '#ccb033', scale: 0.45,
  material: 'copper', rarity: 2,
  bonuses: { electricOhms: 500 },
  weight: 0.06,
});

defineItem('ring_endurance', {
  name: 'Ring of Endurance', type: 'ring',
  glyph: '◌', color: '#f0cf7c', glow: '#c8a658', scale: 0.45,
  material: 'gold', rarity: 2,
  bonuses: { maxStamina: 15, staminaRegen: 0.5 },
  weight: 0.06,
});

defineItem('ring_sorcery', {
  name: 'Ring of Sorcery', type: 'ring',
  glyph: '◌', color: '#9f8dff', glow: '#7360cf', scale: 0.45,
  material: 'silver', rarity: 2,
  bonuses: { maxMana: 10 },
  weight: 0.06,
});

defineItem('ring_channeling', {
  name: 'Ring of Channeling', type: 'ring',
  glyph: '◌', color: '#7fd3ff', glow: '#4b9bc7', scale: 0.45,
  material: 'gold', rarity: 2,
  bonuses: { maxMana: 5, manaRegen: 0.08 },
  weight: 0.06,
});

defineItem('brawler_band', {
  name: "Brawler's Band", type: 'ring',
  glyph: '◌', color: '#d0a272', glow: '#9b7246', scale: 0.45,
  material: 'iron', rarity: 2,
  bonuses: {},
  description: 'A crude iron ring. Your blood runs hot when you wear it.',
  affixes: ['berserk1'],
  weight: 0.05,
});

defineItem('ring_of_fury', {
  name: 'Warband Ring', type: 'ring',
  glyph: '◌', color: '#ff7c6e', glow: '#cf4a3f', scale: 0.45,
  material: 'gold', rarity: 4,
  bonuses: { critChance: 0.05 },
  description: 'A rough gold band etched with battle runes. It pulses warmly in combat.',
  affixes: ['berserk1', 'manaSurge1'],
  weight: 0.06,
});

defineItem('serpent_ring', {
  name: 'Serpent Coil', type: 'ring',
  glyph: '◌', color: '#7cc46b', glow: '#4d8f41', scale: 0.45,
  material: 'silver', rarity: 4,
  bonuses: { manaRegen: 0.15 },
  description: 'A silver band shaped like a biting snake. Its eyes glint with cunning.',
  affixes: ['manaSurge1', 'frostbite1'],
  weight: 0.05,
});

defineItem('ring_ironwill', {
  name: 'Ring of Iron Will', type: 'ring',
  glyph: '◌', color: '#b0bcc8', glow: '#7a8694', scale: 0.45,
  material: 'gold', rarity: 5,
  bonuses: { maxHp: 15, defense: 2, bluntResist: 0.1, poisonResist: 0.1 },
  description: 'A band of hardened gold inlaid with runes of fortitude. The wearer shrugs off what would fell lesser mortals.',
  affixes: ['life1'],
  weight: 0.06,
});

defineItem('ring_fateweaver', {
  name: "Fateweaver's Band", type: 'ring',
  glyph: '◌', color: '#d4a8e0', glow: '#a070b8', scale: 0.45,
  material: 'gold', rarity: 5,
  bonuses: { critChance: 0.08, critMult: 0.15, attack: 1, luck: 3 },
  description: 'Fate bends around this ring like light around a star. Every strike finds its mark.',
  affixes: ['berserk1'],
  weight: 0.06,
});

defineItem('ring_voidchannel', {
  name: 'Voidchannel Ring', type: 'ring',
  glyph: '◌', color: '#6a5a8a', glow: '#3a2a5a', scale: 0.45,
  material: 'silver', rarity: 5,
  bonuses: { maxMana: 15, manaRegen: 0.4, spellHit: 2, critChance: 0.04 },
  description: 'The gem at its center is not a stone but a window into the void, from which raw mana pours.',
  affixes: ['manaSurge1'],
  weight: 0.05,
});

defineItem('ring_conflict', {
  name: 'Ring of Conflict', type: 'ring',
  glyph: '◌', color: '#dd5544', glow: '#aa2222', scale: 0.45,
  material: 'iron', rarity: 4,
  bonuses: {},
  tags: ['conflict'],
  description: 'A jagged band of blackened iron that hums with discord. Nearby creatures turn on each other in blind rage.',
  weight: 0.06,
});

defineItem('bloodward_signet', {
  name: 'Bloodward Signet', type: 'ring',
  glyph: '◌', color: '#c86060', glow: '#8a3030', scale: 0.45,
  material: 'gold', rarity: 4,
  bonuses: { attack: 1 },
  description: 'A heavy gold ring caked with old blood. It banks a fraction of every wound you deal and pays it back when you bleed.',
  procPackages: ['bloodTithe'],
  weight: 0.06,
});
