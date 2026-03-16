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
      { type: "equip", weight: 20, pool: ["helm_iron"], affixChance: 0 },
      { type: "equip", weight: 18, pool: ["amulet_guarded"], affixChance: 0 },
      { type: "equip", weight: 18, pool: ["belt_leather"], affixChance: 0 },
      { type: "equip", weight: 18, pool: ["gloves_leather"], affixChance: 0 },
      { type: "equip", weight: 18, pool: ["leggings_leather"], affixChance: 0 },
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
      { type: "equip", weight: 16, pool: ["helm_iron", "helm_steel"], affixChance: 0.3, affixCountMax: 1 },
      { type: "equip", weight: 16, pool: ["amulet_vigor"], affixChance: 0.25, affixCountMax: 1 },
      { type: "equip", weight: 16, pool: ["belt_girded"], affixChance: 0.25, affixCountMax: 1 },
      { type: "equip", weight: 16, pool: ["gauntlets_iron"], affixChance: 0.25, affixCountMax: 1 },
      { type: "equip", weight: 16, pool: ["greaves_steel"], affixChance: 0.25, affixCountMax: 1 },
      { type: "equip", weight: 20, pool: ["shield_iron"], affixChance: 0.3, affixCountMax: 1 },
      { type: "equip", weight: 20, pool: ["ring_health"], affixChance: 0.2, affixCountMax: 1 },
      { type: "equip", weight: 20, pool: ["ring_precision"], affixChance: 0.2, affixCountMax: 1 },
      { type: "equip", weight: 15, pool: ["ring_arcana"], affixChance: 0.25, affixCountMax: 1 },
      { type: "equip", weight: 15, pool: ["ring_fire_resist"], affixChance: 0.2, affixCountMax: 1 },
      { type: "equip", weight: 15, pool: ["ring_poison_resist"], affixChance: 0.2, affixCountMax: 1 },
      { type: "equip", weight: 12, pool: ["ring_hunger"], affixChance: 0 },
      { type: "equip", weight: 10, pool: ["ring_fumbling"], affixChance: 0 },
      { type: "equip", weight: 10, pool: ["ring_weakness"], affixChance: 0 },
      { type: "equip", weight: 8,  pool: ["ring_blindness"], affixChance: 0 },
      { type: "equip", weight: 6,  pool: ["ring_teleportation"], affixChance: 0 },
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

  "sub:equip_early_proc": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "equip", weight: 20, pool: ["sparking_knife"], affixChance: 0 },
      { type: "equip", weight: 20, pool: ["smoldering_club"], affixChance: 0 },
      { type: "equip", weight: 20, pool: ["chipped_fang"], affixChance: 0 },
      { type: "equip", weight: 18, pool: ["leech_blade"], affixChance: 0 },
      { type: "equip", weight: 16, pool: ["ember_knife"], affixChance: 0 },
      { type: "equip", weight: 15, pool: ["rusted_buckler"], affixChance: 0 },
      { type: "equip", weight: 12, pool: ["brawler_band"], affixChance: 0 },
    ],
  },

  "sub:equip_rare": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "equip", weight: 20, pool: ["nightfang_dagger"], affixChance: 0 },
      { type: "equip", weight: 18, pool: ["caustic_stiletto"], affixChance: 0 },
      { type: "equip", weight: 18, pool: ["stormtouched_mace"], affixChance: 0 },
      { type: "equip", weight: 15, pool: ["grounded_buckler"], affixChance: 0 },
      { type: "equip", weight: 15, pool: ["warhammer_of_fury"], affixChance: 0 },
      { type: "equip", weight: 14, pool: ["flametongue"], affixChance: 0 },
      { type: "equip", weight: 14, pool: ["helm_horned", "helm_mage"], affixChance: 0 },
      { type: "equip", weight: 14, pool: ["amulet_warding", "amulet_focus"], affixChance: 0 },
      { type: "equip", weight: 14, pool: ["belt_chain", "belt_ranger"], affixChance: 0 },
      { type: "equip", weight: 14, pool: ["gauntlets_steel", "gloves_thieves"], affixChance: 0 },
    ],
  },

  "sub:equip_epic": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "equip", weight: 18, pool: ["pyreheart_mace"], affixChance: 0 },
      { type: "equip", weight: 15, pool: ["ashen_reaver"], affixChance: 0 },
      { type: "equip", weight: 18, pool: ["glacial_edge"], affixChance: 0 },
      { type: "equip", weight: 15, pool: ["ring_of_fury"], affixChance: 0 },
      { type: "equip", weight: 15, pool: ["witchfire_sword"], affixChance: 0 },
      { type: "equip", weight: 15, pool: ["howling_maul"], affixChance: 0 },
      { type: "equip", weight: 12, pool: ["wardkeeper_shield"], affixChance: 0 },
      { type: "equip", weight: 12, pool: ["serpent_ring"], affixChance: 0 },
      { type: "equip", weight: 12, pool: ["helm_warhelm", "helm_visionary"], affixChance: 0 },
      { type: "equip", weight: 12, pool: ["pendant_soulkeeper", "pendant_stormward"], affixChance: 0 },
      { type: "equip", weight: 12, pool: ["belt_ironhide", "belt_vitality"], affixChance: 0 },
      { type: "equip", weight: 12, pool: ["gauntlets_spiked", "gloves_arcane"], affixChance: 0 },
    ],
  },

  "sub:equip_legendary": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "equip", weight: 35, pool: ["stormcaller_blade"], affixChance: 0 },
      { type: "equip", weight: 35, pool: ["soulreaver_axe"], affixChance: 0 },
      { type: "equip", weight: 30, pool: ["aegis_of_the_ancient"], affixChance: 0 },
      { type: "equip", weight: 25, pool: ["helm_dreadnought", "helm_allseeing"], affixChance: 0 },
      { type: "equip", weight: 25, pool: ["amulet_lifeblood", "amulet_arcanum"], affixChance: 0 },
      { type: "equip", weight: 25, pool: ["belt_titan", "belt_serpent"], affixChance: 0 },
      { type: "equip", weight: 25, pool: ["gauntlets_dragonscale", "gloves_shadow"], affixChance: 0 },
    ],
  },

  "sub:potions": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "archetype", weight: 30, archetype: "HealthPotion" },
      { type: "item",      weight: 18, itemId: "potion_vigor" },
      { type: "item",      weight: 20, itemId: "potion_endurance" },
      { type: "item",      weight: 15, itemId: "potion_second_wind" },
      { type: "item",      weight: 12, itemId: "potion_adrenaline" },
      { type: "item",      weight: 10, itemId: "potion_mana" },
      { type: "item",      weight: 10, itemId: "potion_stoneskin" },
      { type: "item",      weight: 10, itemId: "potion_water" },
      { type: "item",      weight: 7,  itemId: "potion_poison" },
      { type: "item",      weight: 8,  itemId: "potion_sickness" },
      { type: "item",      weight: 5,  itemId: "potion_resist_fire" },
      { type: "item",      weight: 5,  itemId: "potion_resist_poison" },
      { type: "item",      weight: 5,  itemId: "potion_resist_electric" },
      { type: "item",      weight: 5,  itemId: "potion_resist_acid" },
    ],
  },

  "sub:scrolls": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "item",      weight: 50, itemId: "scroll_identify" },
      { type: "archetype", weight: 35, archetype: "ScrollOfMapping" },
      { type: "item",      weight: 25, itemId: "scroll_blastwave" },
      { type: "archetype", weight: 15, archetype: "ArrowsStack" },
      { type: "item",      weight: 5,  itemId: "scroll_homecoming" },
      { type: "item",      weight: 8,  itemId: "potion_stoneskin" },
      { type: "item",      weight: 12, itemId: "scroll_amnesia" },
      { type: "item",      weight: 10, itemId: "scroll_fire" },
      { type: "item",      weight: 10, itemId: "scroll_aggravation" },
      { type: "item",      weight: 8,  itemId: "scroll_remove_curse" },
      { type: "item",      weight: 3,  itemId: "scroll_genocide" },
    ],
  },

  "sub:spellbooks": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "item", weight: 35, itemId: "book_lightning" },
      { type: "item", weight: 35, itemId: "book_meteor" },
      { type: "item", weight: 30, itemId: "book_blastwave" },
      { type: "item", weight: 25, itemId: "book_frost" },
      { type: "item", weight: 22, itemId: "book_blizzard" },
      { type: "item", weight: 20, itemId: "book_blink" },
      { type: "item", weight: 18, itemId: "book_firestorm" },
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
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "nothing",   weight: 150 },
      { type: "gold",      weight: 30, count: { base: 5, perDepth: 2 } },
      { type: "archetype", weight: 15, archetype: "HealthPotion" },
      { type: "table",     weight: 12, tableId: "sub:potions" },
      { type: "table",     weight: 20, tableId: "sub:equip_common" },
      { type: "table",     weight: 8,  tableId: "sub:equip_early_proc" },
      { type: "table",     weight: 10, tableId: "sub:scrolls" },
      { type: "archetype", weight: 10, archetype: "Ration" },
    ],
  },

  "drop:tier1": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "nothing",   weight: 100 },
      { type: "gold",      weight: 25, count: { base: 8, perDepth: 3 } },
      { type: "table",     weight: 18, tableId: "sub:potions" },
      { type: "table",     weight: 15, tableId: "sub:equip_common" },
      { type: "table",     weight: 7,  tableId: "sub:equip_early_proc" },
      { type: "table",     weight: 4,  tableId: "sub:equip_rare" },
      { type: "equip",     weight: 10, pool: ["axe_heavy", "chain_armor", "amulet_vigor", "belt_girded", "gauntlets_iron", "greaves_steel", "helm_steel", "ring_health", "ring_fire_resist", "ring_poison_resist", "warhammer", "venomfang_dagger", "ring_endurance"], affixChance: 0.20, affixCountMax: 1 },
      { type: "table",     weight: 15, tableId: "sub:scrolls" },
      { type: "table",     weight: 10, tableId: "sub:spellbooks" },
      { type: "table",     weight: 5,  tableId: "sub:wands" },
      { type: "archetype", weight: 8,  archetype: "Ration" },
    ],
  },

  "drop:tier2": {
    rolls: { min: 1, max: 2 },
    entries: [
      { type: "nothing",   weight: 60 },
      { type: "gold",      weight: 20, count: { base: 15, perDepth: 5 } },
      { type: "table",     weight: 18, tableId: "sub:potions" },
      { type: "table",     weight: 20, tableId: "sub:equip_magic" },
      { type: "table",     weight: 10, tableId: "sub:equip_rare" },
      { type: "table",     weight: 6,  tableId: "sub:equip_epic" },
      { type: "table",     weight: 15, tableId: "sub:scrolls" },
      { type: "table",     weight: 15, tableId: "sub:spellbooks" },
      { type: "equip",     weight: 15, pool: ["ring_health", "ring_precision", "ring_arcana", "ring_fire_resist", "ring_poison_resist", "ring_endurance"], affixChance: 0.40, affixCountMax: 1 },
      { type: "table",     weight: 10, tableId: "sub:wands" },
      { type: "archetype", weight: 5,  archetype: "IronRation" },
    ],
  },

  "drop:tier3": {
    rolls: { min: 1, max: 2 },
    entries: [
      { type: "nothing",   weight: 30 },
      { type: "gold",      weight: 15, count: { base: 30, perDepth: 8 } },
      { type: "table",     weight: 15, tableId: "sub:potions" },
      { type: "table",     weight: 25, tableId: "sub:equip_magic" },
      { type: "table",     weight: 20, tableId: "sub:spellbooks" },
      { type: "table",     weight: 15, tableId: "sub:scrolls" },
      { type: "equip",     weight: 15, pool: ["axe_heavy", "chain_armor", "amulet_vigor", "belt_girded", "gauntlets_iron", "greaves_steel", "helm_steel", "shield_iron", "ring_health", "ring_precision", "ring_arcana", "ring_fire_resist", "ring_poison_resist", "shield_fireward", "warhammer", "venomfang_dagger", "leadweave_mantle", "ring_endurance", "shield_spiked_pavise"],
        affixChance: 0.80, affixCountMax: 2 },
      { type: "equip",     weight: 8,  pool: ["caustic_stiletto", "stormtouched_mace", "grounded_buckler"],
        affixChance: 0 },
      { type: "table",     weight: 10, tableId: "sub:equip_epic" },
      { type: "table",     weight: 5,  tableId: "sub:equip_legendary" },
      { type: "table",     weight: 12, tableId: "sub:wands" },
    ],
  },

  // ── Monster-specific overrides ────────────────────────────────────

  "drop:pit_viper": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "table",     weight: 40, tableId: "sub:equip_early_proc" },
      { type: "equip",     weight: 12, pool: ["venomfang_dagger"], affixChance: 0 },
      { type: "table",     weight: 25, tableId: "sub:equip_common" },
      { type: "table",     weight: 15, tableId: "sub:potions" },
      { type: "gold",      weight: 15, count: { base: 33, perDepth: 3 } },
      { type: "table",     weight: 5,  tableId: "sub:scrolls" },
    ],
  },

  "drop:goblin": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "nothing",   weight: 120 },
      { type: "gold",      weight: 30, count: { base: 5, perDepth: 3 } },
      { type: "equip",     weight: 25, pool: ["dagger_quick"], affixChance: 0.15, affixCountMax: 1 },
      { type: "table",     weight: 5,  tableId: "sub:equip_early_proc" },
      { type: "archetype", weight: 20, archetype: "ArrowsStack" },
      { type: "archetype", weight: 15, archetype: "HealthPotion" },
      { type: "table",     weight: 10, tableId: "sub:scrolls" },
    ],
  },

  "drop:dragon_whelp": {
    rolls: { min: 1, max: 2 },
    entries: [
      { type: "nothing",   weight: 35 },
      { type: "gold",      weight: 28, count: { base: 20, perDepth: 4 } },
      { type: "equip",     weight: 18, pool: ["ember_knife", "smoldering_club", "ring_fire_resist"], affixChance: 0 },
      { type: "equip",     weight: 12, pool: ["shield_fireward"], affixChance: 0.15, affixCountMax: 1 },
      { type: "table",     weight: 18, tableId: "sub:potions" },
      { type: "item",      weight: 10, itemId: "potion_resist_fire" },
      { type: "table",     weight: 10, tableId: "sub:scrolls" },
    ],
  },

  "drop:dragon": {
    rolls: { min: 1, max: 3 },
    entries: [
      { type: "nothing",   weight: 20 },
      { type: "gold",      weight: 30, count: { base: 50, perDepth: 10 } },
      { type: "equip",     weight: 25, pool: ["axe_heavy", "chain_armor", "amulet_vigor", "belt_girded", "gauntlets_iron", "greaves_steel", "helm_steel", "shield_iron", "ring_health", "ring_precision", "ring_arcana", "ring_fire_resist", "ring_poison_resist", "shield_fireward", "warhammer", "leadweave_mantle", "ring_endurance", "shield_spiked_pavise"],
        affixChance: 0.80, affixCountMax: 2 },
      { type: "equip",     weight: 10, pool: ["caustic_stiletto", "stormtouched_mace", "grounded_buckler"],
        affixChance: 0 },
      { type: "table",     weight: 12, tableId: "sub:equip_epic" },
      { type: "table",     weight: 8,  tableId: "sub:equip_legendary" },
      { type: "table",     weight: 20, tableId: "sub:spellbooks" },
      { type: "archetype", weight: 15, archetype: "HealthPotion" },
      { type: "table",     weight: 10, tableId: "sub:scrolls" },
    ],
  },

  "drop:lich": {
    rolls: { min: 1, max: 2 },
    entries: [
      { type: "nothing",   weight: 25 },
      { type: "table",     weight: 30, tableId: "sub:spellbooks" },
      { type: "gold",      weight: 20, count: { base: 20, perDepth: 5 } },
      { type: "table",     weight: 15, tableId: "sub:scrolls" },
      { type: "equip",     weight: 15, pool: ["amulet_vigor", "belt_girded", "gauntlets_iron", "greaves_steel", "helm_steel", "ring_health", "ring_precision", "ring_arcana", "ring_fire_resist", "ring_poison_resist", "ring_endurance"],
        affixChance: 0.50, affixCountMax: 2 },
      { type: "table",     weight: 6,  tableId: "sub:equip_epic" },
      { type: "archetype", weight: 15, archetype: "HealthPotion" },
      { type: "table",     weight: 10, tableId: "sub:wands" },
    ],
  },

  // ── Chest tables ──────────────────────────────────────────────────
  // Max 1 weapon per chest - equipment split into weapon vs armor/jewelry

  "chest:basic": {
    rolls: { min: 1, max: 2 },
    entries: [
      { type: "gold",      weight: 30, count: { base: 8, perDepth: 3 } },
      { type: "table",     weight: 25, tableId: "sub:potions" },
      { type: "equip",     weight: 12, pool: ["sword_plain", "dagger_quick", "bow_short"], affixChance: 0 },
      { type: "equip",     weight: 12, pool: ["leather_armor", "helm_iron", "amulet_guarded", "belt_leather", "gloves_leather", "leggings_leather", "shield_wood"], affixChance: 0 },
      { type: "equip",     weight: 6,  pool: ["sparking_knife", "smoldering_club", "chipped_fang"], affixChance: 0 },
      { type: "archetype", weight: 12, archetype: "ArrowsStack" },
      { type: "table",     weight: 15, tableId: "sub:scrolls" },
      { type: "table",     weight: 18, tableId: "sub:spellbooks" },
      { type: "table",     weight: 8,  tableId: "sub:wands" },
      { type: "archetype", weight: 10, archetype: "Ration" },
      { type: "gem",       weight: 5,  materials: ["gemstone", "glass"] },
    ],
  },

  "chest:magic": {
    rolls: { min: 2, max: 3 },
    entries: [
      { type: "gold",      weight: 25, count: { base: 15, perDepth: 5 } },
      { type: "table",     weight: 22, tableId: "sub:potions" },
      { type: "equip",     weight: 15, pool: ["axe_heavy", "longsword", "warhammer", "venomfang_dagger"], affixChance: 0.40, affixCountMax: 1 },
      { type: "equip",     weight: 15, pool: ["chain_armor", "helm_iron", "helm_steel", "amulet_vigor", "belt_girded", "gauntlets_iron", "greaves_steel", "shield_iron", "shield_fireward", "ring_health", "ring_precision", "ring_fire_resist"], affixChance: 0.40, affixCountMax: 1 },
      { type: "equip",     weight: 8,  pool: ["caustic_stiletto", "stormtouched_mace"], affixChance: 0 },
      { type: "table",     weight: 20, tableId: "sub:spellbooks" },
      { type: "table",     weight: 18, tableId: "sub:scrolls" },
      { type: "table",     weight: 12, tableId: "sub:wands" },
      { type: "archetype", weight: 8,  archetype: "IronRation" },
      { type: "gem",       weight: 8,  materials: ["gemstone", "glass"] },
    ],
  },

  "chest:legendary": {
    rolls: { min: 2, max: 4 },
    entries: [
      { type: "gold",      weight: 25, count: { base: 40, perDepth: 8 } },
      { type: "equip",     weight: 18, pool: ["nightfang_dagger", "pyreheart_mace", "glacial_edge", "witchfire_sword", "howling_maul", "stormcaller_blade", "soulreaver_axe"], affixChance: 0.70, affixCountMax: 2 },
      { type: "equip",     weight: 18, pool: ["helm_warhelm", "helm_visionary", "pendant_soulkeeper", "pendant_stormward", "belt_ironhide", "belt_vitality", "gauntlets_spiked", "gloves_arcane", "amulet_vigor", "belt_girded", "gauntlets_iron", "greaves_steel", "ring_health", "ring_precision", "ring_arcana", "ring_endurance", "ring_of_fury", "serpent_ring", "wardkeeper_shield", "aegis_of_the_ancient"], affixChance: 0.70, affixCountMax: 2 },
      { type: "table",     weight: 25, tableId: "sub:spellbooks" },
      { type: "table",     weight: 20, tableId: "sub:scrolls" },
      { type: "archetype", weight: 18, archetype: "HealthPotion" },
      { type: "table",     weight: 15, tableId: "sub:wands" },
      { type: "gem",       weight: 10, materials: ["gemstone"] },
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
      { type: "table",     weight: 22, tableId: "sub:potions" },
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
      { type: "table",     weight: 22, tableId: "sub:potions" },
      { type: "table",     weight: 25, tableId: "sub:equip_magic" },
      { type: "table",     weight: 10, tableId: "sub:scrolls" },
      { type: "table",     weight: 10, tableId: "sub:spellbooks" },
      { type: "gem",       weight: 5,  materials: ["gemstone", "glass"] },
    ],
  },

  // ── Weapon rack tables ────────────────────────────────────────────
  // 1-3 items; "nothing" entries model empty slots on the rack.

  "rack:weapons": {
    rolls: { min: 1, max: 3 },
    entries: [
      { type: "nothing", weight: 20 },
      { type: "equip",   weight: 25, pool: ["sword_plain"],   affixChance: 0 },
      { type: "equip",   weight: 25, pool: ["dagger_quick"],  affixChance: 0 },
      { type: "equip",   weight: 20, pool: ["axe_heavy"],     affixChance: 0 },
      { type: "equip",   weight: 20, pool: ["bow_short"],     affixChance: 0 },
      { type: "equip",   weight: 18, pool: ["iron_mace"],     affixChance: 0 },
      { type: "equip",   weight: 15, pool: ["longsword"],     affixChance: 0 },
      { type: "equip",   weight: 10, pool: ["iron_pickaxe"],  affixChance: 0 },
    ],
  },

  "rack:weapons:magic": {
    rolls: { min: 1, max: 3 },
    entries: [
      { type: "nothing", weight: 15 },
      { type: "equip",   weight: 22, pool: ["longsword"],          affixChance: 0.40, affixCountMax: 1 },
      { type: "equip",   weight: 20, pool: ["axe_heavy"],          affixChance: 0.30, affixCountMax: 1 },
      { type: "equip",   weight: 18, pool: ["warhammer"],          affixChance: 0.35, affixCountMax: 1 },
      { type: "equip",   weight: 16, pool: ["venomfang_dagger"],   affixChance: 0.30, affixCountMax: 1 },
      { type: "equip",   weight: 14, pool: ["caustic_stiletto"],   affixChance: 0 },
      { type: "equip",   weight: 12, pool: ["stormtouched_mace"],  affixChance: 0 },
    ],
  },
};

export function getTable(id) { return /** @type {any} */ (LOOT_TABLES)[id] || null; }
