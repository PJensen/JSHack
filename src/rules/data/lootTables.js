// rules/data/lootTables.js
// Pure data declarations for all loot tables.
// Entry types:
//   "nothing"   - empty drop (controls drop rate)
//   "gold"      - gold stack, count scales with depth: base + depth * perDepth
//   "archetype" - named archetype (HealthPotion, ArrowsStack, ScrollOfMapping)
//   "equip"     - equipment from pool[] with optional affix rolling
//   "item"      - from ITEM_CATALOG magic entries (spellbooks, scrolls, wands)
//   "gem"       - random gem via pickGem(); optional gemId for specific, materials[] to filter
//   "table"     - nested table reference (composable)

export const LOOT_TABLES = {

  // ── Shared sub-tables ─────────────────────────────────────────────

  "sub:equip_common": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "equip", weight: 20, pool: ["sword_plain"], affixChance: 0 },
      { type: "equip", weight: 20, pool: ["dagger_quick"], affixChance: 0 },
      { type: "equip", weight: 20, pool: ["leather_armor"], affixChance: 0 },
      { type: "equip", weight: 20, pool: ["shield_wood"], affixChance: 0 },
      { type: "equip", weight: 20, pool: ["bow_short"], affixChance: 0 },
      { type: "equip", weight: 10, pool: ["iron_pickaxe"], affixChance: 0 },
    ],
  },

  "sub:equip_magic": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "equip", weight: 20, pool: ["axe_heavy"], affixChance: 0.3, affixCountMax: 1 },
      { type: "equip", weight: 20, pool: ["chain_armor"], affixChance: 0.3, affixCountMax: 1 },
      { type: "equip", weight: 20, pool: ["shield_iron"], affixChance: 0.3, affixCountMax: 1 },
      { type: "equip", weight: 20, pool: ["ring_health"], affixChance: 0.2, affixCountMax: 1 },
      { type: "equip", weight: 20, pool: ["ring_precision"], affixChance: 0.2, affixCountMax: 1 },
      { type: "equip", weight: 15, pool: ["ring_arcana"], affixChance: 0.25, affixCountMax: 1 },
      { type: "equip", weight: 15, pool: ["ring_fire_resist"], affixChance: 0.2, affixCountMax: 1 },
      { type: "equip", weight: 15, pool: ["ring_poison_resist"], affixChance: 0.2, affixCountMax: 1 },
      { type: "equip", weight: 12, pool: ["shield_fireward"], affixChance: 0.3, affixCountMax: 1 },
      { type: "equip", weight: 18, pool: ["warhammer"], affixChance: 0.3, affixCountMax: 1 },
      { type: "equip", weight: 16, pool: ["venomfang_dagger"], affixChance: 0.25, affixCountMax: 1 },
      { type: "equip", weight: 12, pool: ["leadweave_mantle"], affixChance: 0.3, affixCountMax: 1 },
      { type: "equip", weight: 18, pool: ["ring_endurance"], affixChance: 0.2, affixCountMax: 1 },
      { type: "equip", weight: 16, pool: ["shield_spiked_pavise"], affixChance: 0.3, affixCountMax: 1 },
      { type: "equip", weight: 8,  pool: ["caustic_stiletto"], affixChance: 0 },
      { type: "equip", weight: 8,  pool: ["stormtouched_mace"], affixChance: 0 },
      { type: "equip", weight: 8,  pool: ["grounded_buckler"], affixChance: 0 },
    ],
  },

  "sub:scrolls": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "archetype", weight: 50, archetype: "ScrollOfMapping" },
      { type: "item",      weight: 30, itemId: "scroll_blastwave" },
      { type: "archetype", weight: 20, archetype: "ArrowsStack" },
    ],
  },

  "sub:spellbooks": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "item", weight: 35, itemId: "book_lightning" },
      { type: "item", weight: 35, itemId: "book_meteor" },
      { type: "item", weight: 30, itemId: "book_blastwave" },
    ],
  },

  "sub:wands": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "item", weight: 40, itemId: "wand_lightning" },
      { type: "item", weight: 35, itemId: "wand_meteor" },
      { type: "item", weight: 25, itemId: "wand_frost" },
    ],
  },

  "sub:food": {
    rolls: { min: 1, max: 2 },
    entries: [
      { type: "archetype", weight: 45, archetype: "Ration" },
      { type: "archetype", weight: 25, archetype: "IronRation" },
      { type: "archetype", weight: 18, archetype: "WildBerries" },
      { type: "archetype", weight: 12, archetype: "WildHerbs" },
    ],
  },

  // ── Monster tier defaults ─────────────────────────────────────────

  "drop:tier0": {
    rolls: { min: 1, max: 2 },
    entries: [
      { type: "nothing",   weight: 15 },
      { type: "gold",      weight: 30, count: { base: 5, perDepth: 2 } },
      { type: "archetype", weight: 25, archetype: "HealthPotion" },
      { type: "table",     weight: 20, tableId: "sub:equip_common" },
      { type: "table",     weight: 10, tableId: "sub:scrolls" },
      { type: "archetype", weight: 10, archetype: "Ration" },
    ],
  },

  "drop:tier1": {
    rolls: { min: 1, max: 3 },
    entries: [
      { type: "nothing",   weight: 10 },
      { type: "gold",      weight: 25, count: { base: 8, perDepth: 3 } },
      { type: "archetype", weight: 15, archetype: "HealthPotion" },
      { type: "table",     weight: 15, tableId: "sub:equip_common" },
      { type: "equip",     weight: 10, pool: ["axe_heavy", "chain_armor", "ring_health", "ring_fire_resist", "ring_poison_resist", "warhammer", "venomfang_dagger", "ring_endurance"], affixChance: 0.20, affixCountMax: 1 },
      { type: "table",     weight: 15, tableId: "sub:scrolls" },
      { type: "table",     weight: 10, tableId: "sub:spellbooks" },
      { type: "table",     weight: 5,  tableId: "sub:wands" },
      { type: "archetype", weight: 8,  archetype: "Ration" },
    ],
  },

  "drop:tier2": {
    rolls: { min: 2, max: 3 },
    entries: [
      { type: "gold",      weight: 20, count: { base: 15, perDepth: 5 } },
      { type: "archetype", weight: 15, archetype: "HealthPotion" },
      { type: "table",     weight: 20, tableId: "sub:equip_magic" },
      { type: "table",     weight: 15, tableId: "sub:scrolls" },
      { type: "table",     weight: 15, tableId: "sub:spellbooks" },
      { type: "equip",     weight: 15, pool: ["ring_health", "ring_precision", "ring_arcana", "ring_fire_resist", "ring_poison_resist", "ring_endurance"], affixChance: 0.40, affixCountMax: 1 },
      { type: "table",     weight: 10, tableId: "sub:wands" },
      { type: "archetype", weight: 5,  archetype: "IronRation" },
    ],
  },

  "drop:tier3": {
    rolls: { min: 3, max: 5 },
    entries: [
      { type: "gold",      weight: 15, count: { base: 30, perDepth: 8 } },
      { type: "archetype", weight: 10, archetype: "HealthPotion" },
      { type: "table",     weight: 25, tableId: "sub:equip_magic" },
      { type: "table",     weight: 20, tableId: "sub:spellbooks" },
      { type: "table",     weight: 15, tableId: "sub:scrolls" },
      { type: "equip",     weight: 15, pool: ["axe_heavy", "chain_armor", "shield_iron", "ring_health", "ring_precision", "ring_arcana", "ring_fire_resist", "ring_poison_resist", "shield_fireward", "warhammer", "venomfang_dagger", "leadweave_mantle", "ring_endurance", "shield_spiked_pavise"],
        affixChance: 0.80, affixCountMax: 2 },
      { type: "equip",     weight: 8,  pool: ["caustic_stiletto", "stormtouched_mace", "grounded_buckler"],
        affixChance: 0 },
      { type: "table",     weight: 12, tableId: "sub:wands" },
    ],
  },

  // ── Monster-specific overrides ────────────────────────────────────

  "drop:goblin": {
    rolls: { min: 1, max: 3 },
    entries: [
      { type: "gold",      weight: 30, count: { base: 5, perDepth: 3 } },
      { type: "equip",     weight: 25, pool: ["dagger_quick"], affixChance: 0.15, affixCountMax: 1 },
      { type: "archetype", weight: 20, archetype: "ArrowsStack" },
      { type: "archetype", weight: 15, archetype: "HealthPotion" },
      { type: "table",     weight: 10, tableId: "sub:scrolls" },
    ],
  },

  "drop:dragon": {
    rolls: { min: 3, max: 5 },
    entries: [
      { type: "gold",      weight: 30, count: { base: 50, perDepth: 10 } },
      { type: "equip",     weight: 25, pool: ["axe_heavy", "chain_armor", "shield_iron", "ring_health", "ring_precision", "ring_arcana", "ring_fire_resist", "ring_poison_resist", "shield_fireward", "warhammer", "leadweave_mantle", "ring_endurance", "shield_spiked_pavise"],
        affixChance: 0.80, affixCountMax: 2 },
      { type: "equip",     weight: 10, pool: ["caustic_stiletto", "stormtouched_mace", "grounded_buckler"],
        affixChance: 0 },
      { type: "table",     weight: 20, tableId: "sub:spellbooks" },
      { type: "archetype", weight: 15, archetype: "HealthPotion" },
      { type: "table",     weight: 10, tableId: "sub:scrolls" },
    ],
  },

  "drop:lich": {
    rolls: { min: 2, max: 4 },
    entries: [
      { type: "table",     weight: 30, tableId: "sub:spellbooks" },
      { type: "gold",      weight: 20, count: { base: 20, perDepth: 5 } },
      { type: "table",     weight: 15, tableId: "sub:scrolls" },
      { type: "equip",     weight: 15, pool: ["ring_health", "ring_precision", "ring_arcana", "ring_fire_resist", "ring_poison_resist", "ring_endurance"],
        affixChance: 0.50, affixCountMax: 2 },
      { type: "archetype", weight: 15, archetype: "HealthPotion" },
      { type: "table",     weight: 10, tableId: "sub:wands" },
    ],
  },

  // ── Chest tables ──────────────────────────────────────────────────

  "chest:basic": {
    rolls: { min: 2, max: 4 },
    entries: [
      { type: "gold",      weight: 25, count: { base: 8, perDepth: 3 } },
      { type: "archetype", weight: 20, archetype: "HealthPotion" },
      { type: "table",     weight: 15, tableId: "sub:equip_common" },
      { type: "archetype", weight: 10, archetype: "ArrowsStack" },
      { type: "archetype", weight: 5,  archetype: "FireArrowsStack" },
      { type: "table",     weight: 10, tableId: "sub:scrolls" },
      { type: "table",     weight: 15, tableId: "sub:spellbooks" },
      { type: "table",     weight: 5,  tableId: "sub:wands" },
      { type: "archetype", weight: 10, archetype: "Ration" },
      { type: "gem",       weight: 4,  materials: ["gemstone", "glass"] },
    ],
  },

  "chest:magic": {
    rolls: { min: 3, max: 5 },
    entries: [
      { type: "gold",      weight: 20, count: { base: 15, perDepth: 5 } },
      { type: "table",     weight: 25, tableId: "sub:equip_magic" },
      { type: "archetype", weight: 15, archetype: "HealthPotion" },
      { type: "table",     weight: 15, tableId: "sub:spellbooks" },
      { type: "table",     weight: 15, tableId: "sub:scrolls" },
      { type: "equip",     weight: 10, pool: ["axe_heavy", "chain_armor", "shield_iron", "shield_fireward", "warhammer", "venomfang_dagger", "leadweave_mantle", "shield_spiked_pavise"],
        affixChance: 0.50, affixCountMax: 2 },
      { type: "equip",     weight: 6,  pool: ["caustic_stiletto", "stormtouched_mace", "grounded_buckler"],
        affixChance: 0 },
      { type: "table",     weight: 10, tableId: "sub:wands" },
      { type: "archetype", weight: 8,  archetype: "IronRation" },
      { type: "gem",       weight: 6,  materials: ["gemstone", "glass"] },
    ],
  },

  "chest:legendary": {
    rolls: { min: 4, max: 6 },
    entries: [
      { type: "equip",     weight: 30, pool: ["axe_heavy", "chain_armor", "shield_iron", "ring_health", "ring_precision", "ring_arcana", "ring_fire_resist", "ring_poison_resist", "shield_fireward", "warhammer", "venomfang_dagger", "leadweave_mantle", "ring_endurance", "shield_spiked_pavise"],
        affixChance: 0.90, affixCountMax: 3 },
      { type: "equip",     weight: 12, pool: ["caustic_stiletto", "stormtouched_mace", "grounded_buckler"],
        affixChance: 0 },
      { type: "gold",      weight: 20, count: { base: 40, perDepth: 8 } },
      { type: "table",     weight: 20, tableId: "sub:spellbooks" },
      { type: "table",     weight: 15, tableId: "sub:scrolls" },
      { type: "archetype", weight: 15, archetype: "HealthPotion" },
      { type: "table",     weight: 12, tableId: "sub:wands" },
      { type: "gem",       weight: 8,  materials: ["gemstone"] },
    ],
  },

  // ── Shop stock tables ────────────────────────────────────────────

  "shop:equipment": {
    rolls: { min: 2, max: 4 },
    entries: [
      { type: "table",  weight: 40, tableId: "sub:equip_common" },
      { type: "table",  weight: 30, tableId: "sub:equip_magic" },
      { type: "table",  weight: 15, tableId: "sub:scrolls" },
      { type: "table",  weight: 15, tableId: "sub:spellbooks" },
      { type: "table",  weight: 10, tableId: "sub:wands" },
      { type: "table",  weight: 15, tableId: "sub:food" },
    ],
  },

  // ── Floor loot (replaces pickItem) ────────────────────────────────

  "floor:common": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "gold",      weight: 30, count: { base: 5, perDepth: 2 } },
      { type: "archetype", weight: 22, archetype: "HealthPotion" },
      { type: "table",     weight: 18, tableId: "sub:equip_common" },
      { type: "archetype", weight: 10, archetype: "ArrowsStack" },
      { type: "archetype", weight: 5,  archetype: "FireArrowsStack" },
      { type: "table",     weight: 10, tableId: "sub:spellbooks" },
      { type: "table",     weight: 5,  tableId: "sub:scrolls" },
      { type: "archetype", weight: 8,  archetype: "Ration" },
      { type: "gem",       weight: 3,  materials: ["gemstone", "glass"] },
    ],
  },

  "floor:magic": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "gold",      weight: 35, count: { base: 10, perDepth: 4 } },
      { type: "archetype", weight: 20, archetype: "HealthPotion" },
      { type: "table",     weight: 25, tableId: "sub:equip_magic" },
      { type: "table",     weight: 10, tableId: "sub:scrolls" },
      { type: "table",     weight: 10, tableId: "sub:spellbooks" },
      { type: "gem",       weight: 5,  materials: ["gemstone", "glass"] },
    ],
  },
};

export function getTable(id) { return LOOT_TABLES[id] || null; }
