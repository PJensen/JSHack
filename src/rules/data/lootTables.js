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
      { type: "equip", weight: 20, pool: ["sword_plain"], affixChance: 0.25, affixCountMax: 1 },
      { type: "equip", weight: 20, pool: ["dagger_quick"], affixChance: 0.25, affixCountMax: 1 },
      { type: "equip", weight: 20, pool: ["leather_armor", "scavenger_jerkin"], affixChance: 0 },
      { type: "equip", weight: 20, pool: ["helm_iron", "scout_hood"], affixChance: 0 },
      { type: "equip", weight: 18, pool: ["amulet_guarded", "amulet_hearthwire"], affixChance: 0 },
      { type: "equip", weight: 18, pool: ["belt_leather"], affixChance: 0 },
      { type: "equip", weight: 18, pool: ["gloves_leather", "tanner_bracers"], affixChance: 0 },
      { type: "equip", weight: 18, pool: ["leggings_leather"], affixChance: 0 },
      { type: "equip", weight: 20, pool: ["shield_wood"], affixChance: 0 },
      { type: "equip", weight: 20, pool: ["bow_short", "bow_recurve"], affixChance: 0.25, affixCountMax: 1 },
      { type: "equip", weight: 16, pool: ["boots_leather", "trail_boots", "sandals_hemp", "shoes_cloth"], affixChance: 0 },
      { type: "equip", weight: 14, pool: ["morningstar"], affixChance: 0.15, affixCountMax: 1 },
      { type: "equip", weight: 10, pool: ["iron_pickaxe"], affixChance: 0.25, affixCountMax: 1 },
      { type: "equip", weight: 15, pool: ["ring_copper", "ring_bone"], affixChance: 0 },
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
      { type: "equip", weight: 9, pool: ["bow_long"], affixChance: 0.3, affixCountMax: 1 },
      { type: "equip", weight: 9, pool: ["bow_flaming"], affixChance: 0, affixCountMax: 0 },
      { type: "equip", weight: 20, pool: ["ring_health"], affixChance: 0.2, affixCountMax: 1 },
      { type: "equip", weight: 20, pool: ["ring_precision"], affixChance: 0.2, affixCountMax: 1 },
      { type: "equip", weight: 15, pool: ["ring_arcana"], affixChance: 0.25, affixCountMax: 1 },
      { type: "equip", weight: 15, pool: ["ring_fire_resist"], affixChance: 0.2, affixCountMax: 1 },
      { type: "equip", weight: 15, pool: ["ring_poison_resist"], affixChance: 0.2, affixCountMax: 1 },
      { type: "equip", weight: 15, pool: ["ring_cold_resist"], affixChance: 0.2, affixCountMax: 1 },
      { type: "equip", weight: 15, pool: ["ring_shock_resist"], affixChance: 0.2, affixCountMax: 1 },
      { type: "equip", weight: 12, pool: ["ring_hunger"], affixChance: 0 },
      { type: "equip", weight: 10, pool: ["ring_fumbling"], affixChance: 0 },
      { type: "equip", weight: 10, pool: ["ring_weakness"], affixChance: 0 },
      { type: "equip", weight: 8,  pool: ["ring_blindness"], affixChance: 0 },
      { type: "equip", weight: 6,  pool: ["ring_teleportation"], affixChance: 0 },
      { type: "equip", weight: 12, pool: ["shield_fireward"], affixChance: 0.3, affixCountMax: 1 },
      { type: "equip", weight: 18, pool: ["warhammer"], affixChance: 0, affixCountMax: 0 },
      { type: "equip", weight: 14, pool: ["flail"], affixChance: 0, affixCountMax: 0 },
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
      { type: "equip", weight: 12, pool: ["bow_mirror"], affixChance: 0 },
      { type: "equip", weight: 11, pool: ["glacier_sigil"], affixChance: 0 },
      { type: "equip", weight: 14, pool: ["flametongue"], affixChance: 0 },
      { type: "equip", weight: 14, pool: ["helm_horned", "helm_mage"], affixChance: 0 },
      { type: "equip", weight: 14, pool: ["amulet_warding", "amulet_focus"], affixChance: 0 },
      { type: "equip", weight: 14, pool: ["belt_chain", "belt_ranger"], affixChance: 0 },
      { type: "equip", weight: 14, pool: ["gauntlets_steel", "gloves_thieves"], affixChance: 0 },
      { type: "equip", weight: 14, pool: ["legguards_plated", "leggings_scout"], affixChance: 0 },
      { type: "equip", weight: 14, pool: ["boots_ironshod", "boots_strider"], affixChance: 0 },
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
      { type: "equip", weight: 11, pool: ["conduction_lens", "echo_grimoire"], affixChance: 0 },
      { type: "equip", weight: 12, pool: ["bow_composite"], affixChance: 0 },
      { type: "equip", weight: 12, pool: ["wardkeeper_shield"], affixChance: 0 },
      { type: "equip", weight: 8,  pool: ["ring_conflict"], affixChance: 0 },
      { type: "equip", weight: 10, pool: ["sunsword"], affixChance: 0 },
      { type: "equip", weight: 12, pool: ["serpent_ring"], affixChance: 0 },
      { type: "equip", weight: 12, pool: ["helm_warhelm", "helm_visionary"], affixChance: 0 },
      { type: "equip", weight: 12, pool: ["pendant_soulkeeper", "pendant_stormward"], affixChance: 0 },
      { type: "equip", weight: 12, pool: ["belt_ironhide", "belt_vitality"], affixChance: 0 },
      { type: "equip", weight: 12, pool: ["gauntlets_spiked", "gloves_arcane"], affixChance: 0 },
      { type: "equip", weight: 12, pool: ["armor_vanguard", "armor_nightstalker", "armor_arcanist"], affixChance: 0 },
      { type: "equip", weight: 12, pool: ["legguards_fortress", "leggings_prowler", "leggings_mystic", "lodbrok_serpent_bound_breeches"], affixChance: 0 },
      { type: "equip", weight: 12, pool: ["boots_sentinel", "boots_shadowstep", "boots_conduit"], affixChance: 0 },
    ],
  },

  "sub:equip_legendary": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "equip", weight: 35, pool: ["stormcaller_blade"], affixChance: 0 },
      { type: "equip", weight: 35, pool: ["soulreaver_axe"], affixChance: 0 },
      { type: "equip", weight: 25, pool: ["bow_shadow"], affixChance: 0 },
      { type: "equip", weight: 30, pool: ["aegis_of_the_ancient"], affixChance: 0 },
      { type: "equip", weight: 25, pool: ["helm_dreadnought", "helm_allseeing"], affixChance: 0 },
      { type: "equip", weight: 25, pool: ["amulet_lifeblood", "amulet_arcanum"], affixChance: 0 },
      { type: "equip", weight: 25, pool: ["belt_titan", "belt_serpent"], affixChance: 0 },
      { type: "equip", weight: 25, pool: ["gauntlets_dragonscale", "gloves_shadow"], affixChance: 0 },
      { type: "equip", weight: 25, pool: ["armor_bulwark", "armor_phantom"], affixChance: 0 },
      { type: "equip", weight: 25, pool: ["legguards_colossus", "leggings_wraith"], affixChance: 0 },
      { type: "equip", weight: 25, pool: ["boots_earthbound", "boots_phantomstride"], affixChance: 0 },
      { type: "equip", weight: 25, pool: ["ring_ironwill", "ring_fateweaver", "ring_voidchannel"], affixChance: 0 },
    ],
  },

  // Catalog backfill so new/thematic gear can still enter the drop economy.
  "sub:equip_catalog_backfill": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "equip", weight: 1, pool: [
        "staff_oak", "goblin_shiv", "goblin_jagged_shiv", "hobgoblin_warblade", "hobgoblin_serrated_warblade",
        "ogre_crushing_club", "orc_warchief_maul", "pendant_lucky", "lantern", "torch", "goblin_barbed_shortbow",
        "voidmind_athame", "boots_of_vigor", "ring_sorcery", "ring_channeling", "plate_armor", "boots_plate",
        "shield_steel", "blade_of_echoes", "tolling_blade", "debtbringer", "cataclysm_axe", "bloodward_signet",
        "jesters_stiletto", "plague_fang", "hollow_greatsword", "deathascendant_blade", "thundergod_maul",
        "blood_covenant_sword", "hunters_edge", "soul_ascendant_scythe", "hungering_cleaver", "eclipse_maul",
        "tithekeeper_breastplate", "blood_covenant_plate", "tolling_greathelm", "hollow_tide_helm", "echo_pendant",
        "deathascendant_medallion", "jesters_cord", "hungering_girdle", "plague_gauntlets", "predator_wraps",
        "cataclysm_greaves", "soul_debt_greaves", "eclipse_sabatons", "thundergod_greaves", "soulascendant_shield",
        "predator_buckler", "predator_stakebow", "doom_crossbow", "resonant_quarterstaff", "venom_kris",
        "never_sated_warclub", "blood_covenant_rapier", "cataclysm_warspear", "plagueweaver_leathers",
        "storm_channeler_robe", "hollow_berserker_plate", "echo_ringmail", "predator_cowl", "blood_circlet",
        "eternal_hunger_crown", "pendulum_of_three_tolls", "tithekeeper_choker", "eclipse_torc",
        "girdle_of_the_ascendant", "echo_duelist_cord", "tithe_wrapped_fists", "soul_debt_gauntlets",
        "eclipse_gauntlets", "plagueweaver_legwraps", "hungering_chainskirt", "cataclysm_greaves_war",
        "soul_mortgage_treads", "warboots_of_cataclysm", "hollow_tide_boots", "portent_focus", "cataclysm_aegis",
        "bloodpact_orb", "glacier_sigil", "conduction_lens", "echo_grimoire", "lodbrok_serpent_bound_breeches",
      ], affixChance: 0 },
    ],
  },

  "sub:potions": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "archetype", weight: 18, archetype: "HealthPotion" },
      { type: "item",      weight: 18, itemId: "potion_vigor" },
      { type: "item",      weight: 20, itemId: "potion_endurance" },
      { type: "item",      weight: 15, itemId: "potion_second_wind" },
      { type: "item",      weight: 12, itemId: "potion_adrenaline" },
      { type: "item",      weight: 25, itemId: "potion_mana" },
      { type: "item",      weight: 10, itemId: "potion_stoneskin" },
      { type: "item",      weight: 10, itemId: "potion_water" },
      { type: "item",      weight: 7,  itemId: "potion_poison" },
      { type: "item",      weight: 8,  itemId: "potion_sickness" },
      { type: "item",      weight: 6,  itemId: "potion_paralysis" },
      { type: "item",      weight: 6,  itemId: "potion_hallucination" },
      { type: "item",      weight: 6,  itemId: "potion_blindness" },
      { type: "item",      weight: 4,  itemId: "potion_weakness" },
      { type: "item",      weight: 6,  itemId: "potion_confusion" },
      { type: "item",      weight: 5,  itemId: "potion_resist_fire" },
      { type: "item",      weight: 5,  itemId: "potion_resist_poison" },
      { type: "item",      weight: 5,  itemId: "potion_resist_electric" },
      { type: "item",      weight: 5,  itemId: "potion_resist_acid" },
      { type: "item",      weight: 10, itemId: "potion_mana_surge" },
      { type: "item",      weight: 5,  itemId: "potion_keen_edge" },
      { type: "item",      weight: 6,  itemId: "potion_lethargy" },
      { type: "item",      weight: 7,  itemId: "potion_speed" },
      { type: "item",      weight: 6,  itemId: "potion_acid" },
      { type: "item",      weight: 5,  itemId: "potion_oil" },
    ],
  },

  "sub:scrolls": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "item",      weight: 50, itemId: "scroll_identify" },
      { type: "archetype", weight: 35, archetype: "ScrollOfMapping" },
      { type: "item",      weight: 25, itemId: "scroll_blastwave" },
      { type: "item",      weight: 20, itemId: "scroll_heal" },
      { type: "item",      weight: 15, itemId: "scroll_summon_skeleton" },
      { type: "item",      weight: 12, itemId: "scroll_amnesia" },
      { type: "item",      weight: 10, itemId: "scroll_fire" },
      { type: "item",      weight: 10, itemId: "scroll_aggravation" },
      { type: "item",      weight: 10, itemId: "scroll_teleportation" },
      { type: "item",      weight: 8,  itemId: "scroll_cursing" },
      { type: "item",      weight: 8,  itemId: "scroll_summoning" },
      { type: "item",      weight: 10, itemId: "scroll_decay" },
      { type: "item",      weight: 8,  itemId: "scroll_remove_curse" },
      { type: "item",      weight: 5,  itemId: "scroll_homecoming" },
      { type: "item",      weight: 5,  itemId: "scroll_polymorph" },
      { type: "item",      weight: 3,  itemId: "scroll_genocide" },
      { type: "item",      weight: 5,  itemId: "scroll_taming" },
    ],
  },

  "sub:spellbooks": {
    rolls: { min: 1, max: 1 },
    entries: [
      // Destruction / elemental
      { type: "item", weight: 30, itemId: "book_lightning" },
      { type: "item", weight: 25, itemId: "book_meteor" },
      { type: "item", weight: 28, itemId: "book_blastwave" },
      { type: "item", weight: 25, itemId: "book_frost" },
      { type: "item", weight: 18, itemId: "book_blizzard" },
      { type: "item", weight: 18, itemId: "book_firestorm" },
      { type: "item", weight: 28, itemId: "book_fireball" },
      { type: "item", weight: 20, itemId: "book_scorch" },
      { type: "item", weight: 22, itemId: "book_arcane_bolt" },
      // Warrior / melee
      { type: "item", weight: 22, itemId: "book_iron_flesh" },
      { type: "item", weight: 18, itemId: "book_bloodthirst" },
      { type: "item", weight: 25, itemId: "book_cleave" },
      { type: "item", weight: 22, itemId: "book_war_cry" },
      { type: "item", weight: 20, itemId: "book_earthshatter" },
      { type: "item", weight: 12, itemId: "book_rampage" },
      { type: "item", weight: 16, itemId: "book_primal_roar" },
      // Nature / support
      { type: "item", weight: 28, itemId: "book_heal" },
      { type: "item", weight: 22, itemId: "book_barkskin" },
      { type: "item", weight: 22, itemId: "book_thorn_burst" },
      { type: "item", weight: 20, itemId: "book_entangle" },
      { type: "item", weight: 18, itemId: "book_verdant_ward" },
      { type: "item", weight: 14, itemId: "book_harmony_ward" },
      { type: "item", weight: 22, itemId: "book_poison_blade" },
      { type: "item", weight: 14, itemId: "book_plague_swarm" },
      // Rogue / utility
      { type: "item", weight: 20, itemId: "book_quicken" },
      { type: "item", weight: 16, itemId: "book_blind" },
      { type: "item", weight: 16, itemId: "book_shadow_veil" },
      { type: "item", weight: 16, itemId: "book_smoke_bomb" },
      { type: "item", weight: 18, itemId: "book_phase_strike" },
      { type: "item", weight: 20, itemId: "book_blink" },
      { type: "item", weight: 20, itemId: "book_ignite_weapons" },
      // Dark / warlock
      { type: "item", weight: 18, itemId: "book_shadow_bolt" },
      { type: "item", weight: 16, itemId: "book_agony" },
      { type: "item", weight: 14, itemId: "book_mark_of_death" },
      { type: "item", weight: 14, itemId: "book_drain_life" },
      { type: "item", weight: 14, itemId: "book_summon_skeleton" },
      // Holy / cleric
      { type: "item", weight: 22, itemId: "book_flash_heal" },
      { type: "item", weight: 22, itemId: "book_smite" },
      { type: "item", weight: 16, itemId: "book_divine_shield" },
      { type: "item", weight: 16, itemId: "book_purify" },
      { type: "item", weight: 12, itemId: "book_consecrate" },
      // Utility / travel
      { type: "item", weight: 18, itemId: "book_evocation" },
      { type: "item", weight: 16, itemId: "book_homecoming" },
      { type: "item", weight: 14, itemId: "book_hearthstone" },
    ],
  },

  "sub:wands": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "item", weight: 40, itemId: "wand_lightning" },
      { type: "item", weight: 35, itemId: "wand_meteor" },
      { type: "item", weight: 30, itemId: "wand_heal" },
      { type: "item", weight: 25, itemId: "wand_frost" },
      { type: "item", weight: 15, itemId: "wand_stasis" },
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

  "sub:jewelry": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "equip", weight: 30, pool: ["ring_health", "ring_precision", "ring_arcana"], affixChance: 0.15, affixCountMax: 1 },
      { type: "equip", weight: 25, pool: ["amulet_guarded", "amulet_vigor"], affixChance: 0.15, affixCountMax: 1 },
      { type: "equip", weight: 15, pool: ["ring_fire_resist", "ring_poison_resist", "ring_cold_resist", "ring_shock_resist", "ring_endurance"], affixChance: 0.10, affixCountMax: 1 },
      { type: "equip", weight: 10, pool: ["pendant_soulkeeper", "pendant_stormward"], affixChance: 0 },
      { type: "equip", weight: 8,  pool: ["serpent_ring", "ring_of_fury"], affixChance: 0 },
    ],
  },

  "sub:jewelry_cursed": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "equip", weight: 25, pool: ["ring_hunger"], affixChance: 0 },
      { type: "equip", weight: 20, pool: ["ring_fumbling"], affixChance: 0 },
      { type: "equip", weight: 20, pool: ["ring_weakness"], affixChance: 0 },
      { type: "equip", weight: 15, pool: ["ring_blindness"], affixChance: 0 },
      { type: "equip", weight: 10, pool: ["ring_teleportation"], affixChance: 0 },
      { type: "equip", weight: 15, pool: ["ring_fragility"], affixChance: 0 },
      { type: "equip", weight: 12, pool: ["ring_mana_drain"], affixChance: 0 },
      { type: "equip", weight: 12, pool: ["amulet_strangulation"], affixChance: 0 },
      { type: "equip", weight: 15, pool: ["amulet_aggravation"], affixChance: 0 },
    ],
  },

  "sub:melee_weapons": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "equip", weight: 28, pool: ["sword_plain", "dagger_quick"],                       affixChance: 0.20, affixCountMax: 1 },
      { type: "equip", weight: 11, pool: ["axe_heavy"],                                          affixChance: 0.25, affixCountMax: 1 },
      { type: "equip", weight: 11, pool: ["iron_mace"],                                          affixChance: 0, affixCountMax: 0 },
      { type: "equip", weight: 9,  pool: ["morningstar"],                                        affixChance: 0.20, affixCountMax: 1 },
      { type: "equip", weight: 16, pool: ["longsword"],                                          affixChance: 0.30, affixCountMax: 1 },
      { type: "equip", weight: 7,  pool: ["venomfang_dagger"],                                   affixChance: 0.25, affixCountMax: 1 },
      { type: "equip", weight: 7,  pool: ["warhammer"],                                          affixChance: 0, affixCountMax: 0 },
      { type: "equip", weight: 6,  pool: ["flail"],                                              affixChance: 0, affixCountMax: 0 },
      { type: "equip", weight: 8,  pool: ["nightfang_dagger"],                                   affixChance: 0 },
      { type: "equip", weight: 6,  pool: ["pyreheart_mace", "glacial_edge", "witchfire_sword"],  affixChance: 0 },
    ],
  },

  // ── Monster tier defaults (fallback for untagged monsters) ────────
  // Most monsters route through tag-based tables (drop:beast, drop:humanoid,
  // drop:undead, drop:caster). These tier tables serve aberrations, giants,
  // demons, constructs, and anything else that doesn't match a tag.

  "drop:tier0": {
    rolls: { min: 1, max: 2 },
    entries: [
      { type: "nothing",   weight: 40 },
      { type: "gold",      weight: 40, count: { base: 10, perDepth: 6 } },
      { type: "archetype", weight: 10, archetype: "HealthPotion" },
      { type: "item",      weight: 15, itemId: "scroll_identify" },
      { type: "item",      weight: 12, itemId: "potion_mana" },
      { type: "table",     weight: 20, tableId: "sub:potions" },
      { type: "table",     weight: 18, tableId: "sub:scrolls" },
      { type: "archetype", weight: 10, archetype: "Ration" },
      { type: "table",     weight: 8,  tableId: "sub:equip_early_proc" },
      { type: "table",     weight: 5,  tableId: "sub:equip_common" },
      { type: "table",     weight: 5,  tableId: "sub:spellbooks" },
      { type: "archetype", weight: 6,  archetype: "ArrowsStack" },
      { type: "archetype", weight: 2,  archetype: "BluntHeadArrowsStack" },
      { type: "archetype", weight: 1,  archetype: "BodkinArrowsStack" },
      { type: "table",     weight: 2,  tableId: "sub:equip_magic" },
      { type: "table",     weight: 1,  tableId: "sub:equip_rare" },
    ],
  },

  "drop:tier1": {
    rolls: { min: 1, max: 2 },
    entries: [
      { type: "nothing",   weight: 25 },
      { type: "gold",      weight: 40, count: { base: 22, perDepth: 8 } },
      { type: "table",     weight: 25, tableId: "sub:potions" },
      { type: "item",      weight: 12, itemId: "potion_mana" },
      { type: "table",     weight: 20, tableId: "sub:scrolls" },
      { type: "archetype", weight: 14, archetype: "ArrowsStack" },
      { type: "archetype", weight: 4,  archetype: "FireArrowsStack" },
      { type: "archetype", weight: 5,  archetype: "BluntHeadArrowsStack" },
      { type: "archetype", weight: 3,  archetype: "PiercingArrowsStack" },
      { type: "archetype", weight: 4,  archetype: "BodkinArrowsStack" },
      { type: "table",     weight: 8,  tableId: "sub:equip_common" },
      { type: "table",     weight: 10, tableId: "sub:equip_magic" },
      { type: "table",     weight: 12, tableId: "sub:spellbooks" },
      { type: "table",     weight: 8,  tableId: "sub:wands" },
      { type: "table",     weight: 4,  tableId: "sub:equip_rare" },
      { type: "table",     weight: 1,  tableId: "sub:equip_epic" },
      { type: "table",     weight: 2,  tableId: "sub:equip_catalog_backfill" },
      { type: "archetype", weight: 6,  archetype: "Ration" },
    ],
  },

  "drop:tier2": {
    rolls: { min: 1, max: 2 },
    entries: [
      { type: "nothing",   weight: 30 },
      { type: "gold",      weight: 28, count: { base: 28, perDepth: 9 } },
      { type: "table",     weight: 20, tableId: "sub:potions" },
      { type: "item",      weight: 10, itemId: "potion_mana" },
      { type: "table",     weight: 18, tableId: "sub:scrolls" },
      { type: "table",     weight: 14, tableId: "sub:spellbooks" },
      { type: "table",     weight: 16, tableId: "sub:equip_magic" },
      { type: "equip",     weight: 8,  pool: ["ring_health", "ring_precision", "ring_arcana", "ring_fire_resist", "ring_poison_resist", "ring_cold_resist", "ring_shock_resist", "ring_endurance"], affixChance: 0.35, affixCountMax: 1 },
      { type: "table",     weight: 10, tableId: "sub:wands" },
      { type: "archetype", weight: 10, archetype: "ArrowsStack" },
      { type: "archetype", weight: 6,  archetype: "FireArrowsStack" },
      { type: "archetype", weight: 3,  archetype: "PiercingArrowsStack" },
      { type: "archetype", weight: 4,  archetype: "BodkinArrowsStack" },
      { type: "archetype", weight: 2,  archetype: "BluntHeadArrowsStack" },
      { type: "table",     weight: 6,  tableId: "sub:equip_rare" },
      { type: "table",     weight: 2,  tableId: "sub:equip_epic" },
      { type: "table",     weight: 3,  tableId: "sub:equip_catalog_backfill" },
      { type: "archetype", weight: 4,  archetype: "IronRation" },
    ],
  },

  "drop:tier3": {
    rolls: { min: 1, max: 2 },
    entries: [
      { type: "nothing",   weight: 18 },
      { type: "gold",      weight: 22, count: { base: 55, perDepth: 12 } },
      { type: "table",     weight: 16, tableId: "sub:potions" },
      { type: "table",     weight: 22, tableId: "sub:equip_magic" },
      { type: "table",     weight: 18, tableId: "sub:spellbooks" },
      { type: "table",     weight: 14, tableId: "sub:scrolls" },
      { type: "equip",     weight: 11, pool: ["axe_heavy", "chain_armor", "amulet_vigor", "belt_girded", "gauntlets_iron", "greaves_steel", "helm_steel", "shield_iron", "ring_health", "ring_precision", "ring_arcana", "ring_fire_resist", "ring_poison_resist", "ring_cold_resist", "ring_shock_resist", "shield_fireward", "venomfang_dagger", "leadweave_mantle", "ring_endurance", "shield_spiked_pavise"],
        affixChance: 0.70, affixCountMax: 2 },
      { type: "equip",     weight: 1,  pool: ["warhammer"], affixChance: 0, affixCountMax: 0 },
      { type: "table",     weight: 10, tableId: "sub:wands" },
      { type: "archetype", weight: 8,  archetype: "ArrowsStack" },
      { type: "archetype", weight: 6,  archetype: "FireArrowsStack" },
      { type: "archetype", weight: 4,  archetype: "PiercingArrowsStack" },
      { type: "archetype", weight: 3,  archetype: "BodkinArrowsStack" },
      { type: "archetype", weight: 3,  archetype: "BluntHeadArrowsStack" },
      { type: "table",     weight: 6,  tableId: "sub:equip_rare" },
      { type: "table",     weight: 4,  tableId: "sub:equip_epic" },
      { type: "table",     weight: 1,  tableId: "sub:equip_legendary" },
      { type: "table",     weight: 4,  tableId: "sub:equip_catalog_backfill" },
    ],
  },

  // ── Monster-specific tables ─────────────────────────────────────────

  "drop:nymph": {
    rolls: { min: 1, max: 2 },
    entries: [
      { type: "nothing",   weight: 20 },
      { type: "gold",      weight: 40, count: { base: 16, perDepth: 6 } },
      { type: "table",     weight: 20, tableId: "sub:potions" },
      { type: "table",     weight: 15, tableId: "sub:jewelry" },
      { type: "table",     weight: 10, tableId: "sub:scrolls" },
    ],
  },

  // ── Tag-based drop tables ──────────────────────────────────────────
  // getMonsterLootTable() routes here by tag priority:
  //   caster > beast > humanoid > undead > tier fallback

  "drop:beast": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "nothing",   weight: 50 },
      { type: "gold",      weight: 28, count: { base: 5, perDepth: 3 } },
      { type: "archetype", weight: 15, archetype: "Ration" },
      { type: "archetype", weight: 10, archetype: "HealthPotion" },
      { type: "table",     weight: 8,  tableId: "sub:equip_early_proc" },
      { type: "table",     weight: 4,  tableId: "sub:potions" },
      { type: "table",     weight: 3,  tableId: "sub:equip_common" },
    ],
  },

  "drop:venomous": {
    rolls: { min: 1, max: 2 },
    entries: [
      { type: "nothing",   weight: 35 },
      { type: "gold",      weight: 30, count: { base: 8, perDepth: 5 } },
      { type: "item",      weight: 18, itemId: "potion_resist_poison" },
      { type: "item",      weight: 12, itemId: "potion_anti_venom" },
      { type: "table",     weight: 16, tableId: "sub:potions" },
      { type: "table",     weight: 8,  tableId: "sub:equip_early_proc" },
      { type: "archetype", weight: 10, archetype: "HealthPotion" },
      { type: "archetype", weight: 8,  archetype: "Ration" },
    ],
  },

  "drop:humanoid": {
    rolls: { min: 1, max: 2 },
    entries: [
      { type: "nothing",   weight: 28 },
      { type: "gold",      weight: 40, count: { base: 12, perDepth: 7 } },
      { type: "table",     weight: 22, tableId: "sub:potions" },
      { type: "item",      weight: 10, itemId: "potion_mana" },
      { type: "item",      weight: 4,  itemId: "potion_keen_edge" },
      { type: "table",     weight: 18, tableId: "sub:scrolls" },
      { type: "table",     weight: 26, tableId: "sub:melee_weapons" },
      { type: "table",     weight: 10, tableId: "sub:equip_common" },
      { type: "archetype", weight: 16, archetype: "ArrowsStack" },
      { type: "archetype", weight: 8,  archetype: "FireArrowsStack" },
      { type: "archetype", weight: 6,  archetype: "PiercingArrowsStack" },
      { type: "archetype", weight: 5,  archetype: "BodkinArrowsStack" },
      { type: "archetype", weight: 4,  archetype: "BluntHeadArrowsStack" },
      { type: "archetype", weight: 8,  archetype: "Ration" },
      { type: "table",     weight: 8,  tableId: "sub:equip_magic" },
      { type: "table",     weight: 4,  tableId: "sub:equip_rare" },
      { type: "table",     weight: 2,  tableId: "sub:equip_epic" },
    ],
  },

  "drop:undead": {
    rolls: { min: 1, max: 2 },
    entries: [
      { type: "nothing",   weight: 28 },
      { type: "gold",      weight: 38, count: { base: 14, perDepth: 6 } },
      { type: "item",      weight: 12, itemId: "potion_holy_water" },
      { type: "table",     weight: 22, tableId: "sub:scrolls" },
      { type: "table",     weight: 16, tableId: "sub:potions" },
      { type: "table",     weight: 20, tableId: "sub:melee_weapons" },
      { type: "table",     weight: 8,  tableId: "sub:equip_common" },
      { type: "archetype", weight: 8,  archetype: "HealthPotion" },
      { type: "item",      weight: 7,  itemId: "scroll_remove_curse" },
      { type: "item",      weight: 5,  itemId: "scroll_identify" },
      { type: "archetype", weight: 6,  archetype: "ArrowsStack" },
      { type: "archetype", weight: 4,  archetype: "FireArrowsStack" },
      { type: "archetype", weight: 3,  archetype: "PiercingArrowsStack" },
      { type: "archetype", weight: 3,  archetype: "BodkinArrowsStack" },
      { type: "archetype", weight: 2,  archetype: "BluntHeadArrowsStack" },
      { type: "table",     weight: 5,  tableId: "sub:equip_magic" },
      { type: "table",     weight: 2,  tableId: "sub:equip_rare" },
    ],
  },

  "drop:caster": {
    rolls: { min: 1, max: 2 },
    entries: [
      { type: "nothing",   weight: 22 },
      { type: "gold",      weight: 28, count: { base: 16, perDepth: 6 } },
      { type: "table",     weight: 35, tableId: "sub:scrolls" },
      { type: "table",     weight: 28, tableId: "sub:spellbooks" },
      { type: "table",     weight: 20, tableId: "sub:wands" },
      { type: "table",     weight: 18, tableId: "sub:potions" },
      { type: "item",      weight: 15, itemId: "potion_mana" },
      { type: "item",      weight: 10, itemId: "potion_mana_surge" },
      { type: "item",      weight: 8,  itemId: "potion_anti_venom" },
      { type: "item",      weight: 7,  itemId: "potion_resist_poison" },
      { type: "item",      weight: 7,  itemId: "potion_resist_electric" },
      { type: "item",      weight: 7,  itemId: "potion_resist_fire" },
      { type: "item",      weight: 8,  itemId: "scroll_remove_curse" },
      { type: "equip",     weight: 8,  pool: ["ring_arcana", "ring_health", "amulet_vigor", "ring_fire_resist", "ring_poison_resist", "ring_cold_resist", "ring_shock_resist"], affixChance: 0.25, affixCountMax: 1 },
      { type: "table",     weight: 4,  tableId: "sub:equip_magic" },
      { type: "table",     weight: 2,  tableId: "sub:equip_rare" },
      { type: "table",     weight: 1,  tableId: "sub:equip_epic" },
    ],
  },

  // ── Monster-specific overrides ────────────────────────────────────

  "drop:bat": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "nothing",   weight: 68 },
      { type: "gold",      weight: 18, count: { base: 3, perDepth: 2 } },
      { type: "archetype", weight: 8,  archetype: "WildBerries" },
      { type: "archetype", weight: 5,  archetype: "WildHerbs" },
      { type: "table",     weight: 3,  tableId: "sub:potions" },
      { type: "archetype", weight: 2,  archetype: "HealthPotion" },
    ],
  },

  "drop:wight": {
    rolls: { min: 1, max: 2 },
    entries: [
      { type: "nothing",   weight: 20 },
      { type: "gold",      weight: 32, count: { base: 20, perDepth: 6 } },
      { type: "item",      weight: 18, itemId: "potion_holy_water" },
      { type: "item",      weight: 14, itemId: "scroll_remove_curse" },
      { type: "item",      weight: 10, itemId: "potion_anti_venom" },
      { type: "table",     weight: 16, tableId: "sub:potions" },
      { type: "table",     weight: 14, tableId: "sub:scrolls" },
      { type: "table",     weight: 12, tableId: "sub:equip_magic" },
      { type: "archetype", weight: 8,  archetype: "HealthPotion" },
      { type: "archetype", weight: 6,  archetype: "ArrowsStack" },
    ],
  },

  "drop:pit_viper": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "table",     weight: 40, tableId: "sub:equip_early_proc" },
      { type: "equip",     weight: 12, pool: ["venomfang_dagger"], affixChance: 0 },
      { type: "table",     weight: 25, tableId: "sub:equip_common" },
      { type: "table",     weight: 15, tableId: "sub:potions" },
      { type: "gold",      weight: 18, count: { base: 50, perDepth: 5 } },
      { type: "table",     weight: 5,  tableId: "sub:scrolls" },
    ],
  },

  "drop:goblin": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "nothing",   weight: 90 },
      { type: "gold",      weight: 40, count: { base: 10, perDepth: 5 } },
      { type: "equip",     weight: 25, pool: ["dagger_quick"], affixChance: 0.25, affixCountMax: 1 },
      { type: "table",     weight: 5,  tableId: "sub:equip_early_proc" },
      { type: "archetype", weight: 28, archetype: "ArrowsStack" },
      { type: "archetype", weight: 8,  archetype: "FireArrowsStack" },
      { type: "archetype", weight: 6,  archetype: "PiercingArrowsStack" },
      { type: "archetype", weight: 5,  archetype: "BodkinArrowsStack" },
      { type: "archetype", weight: 4,  archetype: "BluntHeadArrowsStack" },
      { type: "archetype", weight: 15, archetype: "HealthPotion" },
      { type: "item",      weight: 10, itemId: "scroll_identify" },
      { type: "table",     weight: 10, tableId: "sub:scrolls" },
    ],
  },

  "drop:loot_goblin": {
    rolls: { min: 3, max: 5 },
    entries: [
      { type: "gold",      weight: 60, count: { base: 35, perDepth: 10 } },
      { type: "table",     weight: 20, tableId: "sub:equip_rare" },
      { type: "table",     weight: 12, tableId: "sub:equip_epic" },
      { type: "table",     weight: 7,  tableId: "sub:equip_legendary" },
      { type: "table",     weight: 10, tableId: "sub:scrolls" },
      { type: "table",     weight: 8,  tableId: "sub:spellbooks" },
    ],
  },

  "hit:loot_goblin": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "gold",      weight: 78, count: { base: 12, perDepth: 4 } },
      { type: "table",     weight: 14, tableId: "sub:equip_rare" },
      { type: "table",     weight: 6,  tableId: "sub:equip_epic" },
      { type: "table",     weight: 2,  tableId: "sub:equip_legendary" },
    ],
  },

  "drop:dragon_whelp": {
    rolls: { min: 1, max: 2 },
    entries: [
      { type: "nothing",   weight: 25 },
      { type: "gold",      weight: 32, count: { base: 35, perDepth: 7 } },
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
      { type: "nothing",   weight: 12 },
      { type: "gold",      weight: 35, count: { base: 85, perDepth: 15 } },
      { type: "equip",     weight: 24, pool: ["axe_heavy", "chain_armor", "amulet_vigor", "belt_girded", "gauntlets_iron", "greaves_steel", "helm_steel", "shield_iron", "ring_health", "ring_precision", "ring_arcana", "ring_fire_resist", "ring_poison_resist", "ring_cold_resist", "ring_shock_resist", "shield_fireward", "leadweave_mantle", "ring_endurance", "shield_spiked_pavise"],
        affixChance: 0.80, affixCountMax: 2 },
      { type: "equip",     weight: 1,  pool: ["warhammer"], affixChance: 0, affixCountMax: 0 },
      { type: "equip",     weight: 10, pool: ["caustic_stiletto", "stormtouched_mace", "grounded_buckler"],
        affixChance: 0 },
      { type: "table",     weight: 12, tableId: "sub:equip_epic" },
      { type: "table",     weight: 8,  tableId: "sub:equip_legendary" },
      { type: "table",     weight: 20, tableId: "sub:spellbooks" },
      { type: "archetype", weight: 15, archetype: "HealthPotion" },
      { type: "item",      weight: 10, itemId: "scroll_identify" },
      { type: "table",     weight: 10, tableId: "sub:scrolls" },
    ],
  },

  "drop:lich": {
    rolls: { min: 1, max: 2 },
    entries: [
      { type: "nothing",   weight: 18 },
      { type: "table",     weight: 30, tableId: "sub:spellbooks" },
      { type: "gold",      weight: 24, count: { base: 35, perDepth: 8 } },
      { type: "table",     weight: 15, tableId: "sub:scrolls" },
      { type: "equip",     weight: 15, pool: ["amulet_vigor", "belt_girded", "gauntlets_iron", "greaves_steel", "helm_steel", "ring_health", "ring_precision", "ring_arcana", "ring_fire_resist", "ring_poison_resist", "ring_cold_resist", "ring_shock_resist", "ring_endurance"],
        affixChance: 0.50, affixCountMax: 2 },
      { type: "table",     weight: 6,  tableId: "sub:equip_epic" },
      { type: "archetype", weight: 15, archetype: "HealthPotion" },
      { type: "item",      weight: 10, itemId: "scroll_identify" },
      { type: "table",     weight: 10, tableId: "sub:wands" },
    ],
  },

  // ── Chest tables ──────────────────────────────────────────────────
  // Max 1 weapon per chest - equipment split into weapon vs armor/jewelry

  "chest:basic": {
    rolls: { min: 2, max: 4 },
    entries: [
      { type: "gold",      weight: 35, count: { base: 12, perDepth: 4 } },
      { type: "table",     weight: 26, tableId: "sub:potions" },
      { type: "equip",     weight: 16, pool: ["sword_plain", "dagger_quick", "bow_short", "bow_recurve"], affixChance: 0.25, affixCountMax: 1 },
      { type: "equip",     weight: 14, pool: ["leather_armor", "scavenger_jerkin", "helm_iron", "scout_hood", "amulet_guarded", "amulet_hearthwire", "belt_leather", "gloves_leather", "tanner_bracers", "leggings_leather", "boots_leather", "trail_boots", "sandals_hemp", "shoes_cloth", "shield_wood", "ring_copper", "ring_bone"], affixChance: 0 },
      { type: "table",     weight: 12, tableId: "sub:equip_early_proc" },
      { type: "table",     weight: 12, tableId: "sub:equip_magic" },
      { type: "table",     weight: 6,  tableId: "sub:equip_rare" },
      { type: "table",     weight: 2,  tableId: "sub:equip_epic" },
      { type: "table",     weight: 1,  tableId: "sub:equip_legendary" },
      { type: "table",     weight: 3,  tableId: "sub:equip_catalog_backfill" },
      { type: "archetype", weight: 20, archetype: "ArrowsStack" },
      { type: "table",     weight: 18, tableId: "sub:scrolls" },
      { type: "table",     weight: 18, tableId: "sub:spellbooks" },
      { type: "table",     weight: 12, tableId: "sub:wands" },
      { type: "archetype", weight: 10, archetype: "Ration" },
      { type: "gem",       weight: 3,  materials: ["gemstone", "glass"] },
    ],
  },

  "chest:magic": {
    rolls: { min: 2, max: 3 },
    entries: [
      { type: "gold",      weight: 25, count: { base: 15, perDepth: 5 } },
      { type: "table",     weight: 22, tableId: "sub:potions" },
      { type: "equip",     weight: 10, pool: ["axe_heavy", "longsword", "venomfang_dagger", "bow_long"], affixChance: 0.40, affixCountMax: 1 },
      { type: "equip",     weight: 2,  pool: ["warhammer"], affixChance: 0, affixCountMax: 0 },
      { type: "equip",     weight: 3,  pool: ["bow_flaming"], affixChance: 0, affixCountMax: 0 },
      { type: "equip",     weight: 15, pool: ["chain_armor", "helm_iron", "helm_steel", "amulet_vigor", "belt_girded", "gauntlets_iron", "greaves_steel", "shield_iron", "shield_fireward", "ring_health", "ring_precision", "ring_fire_resist"], affixChance: 0.40, affixCountMax: 1 },
      { type: "equip",     weight: 8,  pool: ["caustic_stiletto", "stormtouched_mace"], affixChance: 0 },
      { type: "table",     weight: 3,  tableId: "sub:equip_catalog_backfill" },
      { type: "table",     weight: 20, tableId: "sub:spellbooks" },
      { type: "table",     weight: 18, tableId: "sub:scrolls" },
      { type: "table",     weight: 12, tableId: "sub:wands" },
      { type: "archetype", weight: 10, archetype: "ArrowsStack" },
      { type: "archetype", weight: 6,  archetype: "FireArrowsStack" },
      { type: "archetype", weight: 4,  archetype: "BodkinArrowsStack" },
      { type: "archetype", weight: 8,  archetype: "IronRation" },
      { type: "gem",       weight: 3,  materials: ["gemstone", "glass"] },
    ],
  },

  "chest:epic": {
    rolls: { min: 2, max: 4 },
    entries: [
      { type: "gold",      weight: 30, count: { base: 28, perDepth: 6 } },
      { type: "equip",     weight: 3,  pool: ["bow_composite"], affixChance: 0.50, affixCountMax: 2 },
      { type: "equip",     weight: 17, pool: ["nightfang_dagger", "pyreheart_mace", "glacial_edge", "witchfire_sword", "howling_maul", "ashen_reaver"], affixChance: 0, affixCountMax: 0 },
      { type: "equip",     weight: 5,  pool: ["pendant_soulkeeper", "pendant_stormward", "belt_ironhide", "belt_vitality", "gloves_arcane"], affixChance: 0.50, affixCountMax: 2 },
      { type: "equip",     weight: 15, pool: ["helm_warhelm", "helm_visionary", "gauntlets_spiked", "ring_of_fury", "serpent_ring", "wardkeeper_shield", "armor_vanguard", "armor_nightstalker", "armor_arcanist", "legguards_fortress", "leggings_prowler", "leggings_mystic", "lodbrok_serpent_bound_breeches", "boots_sentinel", "boots_shadowstep", "boots_conduit"], affixChance: 0, affixCountMax: 0 },
      { type: "table",     weight: 22, tableId: "sub:spellbooks" },
      { type: "table",     weight: 18, tableId: "sub:scrolls" },
      { type: "item",      weight: 2,  itemId: "stone_touchstone" },
      { type: "archetype", weight: 16, archetype: "HealthPotion" },
      { type: "item",      weight: 11, itemId: "scroll_identify" },
      { type: "table",     weight: 14, tableId: "sub:wands" },
      { type: "archetype", weight: 8,  archetype: "ArrowsStack" },
      { type: "archetype", weight: 6,  archetype: "FireArrowsStack" },
      { type: "archetype", weight: 5,  archetype: "PiercingArrowsStack" },
      { type: "archetype", weight: 4,  archetype: "BodkinArrowsStack" },
      { type: "archetype", weight: 3,  archetype: "BluntHeadArrowsStack" },
      { type: "table",     weight: 8,  tableId: "sub:equip_legendary" },
      { type: "table",     weight: 4,  tableId: "sub:equip_catalog_backfill" },
      { type: "gem",       weight: 4,  materials: ["gemstone"] },
    ],
  },

  "chest:legendary": {
    rolls: { min: 2, max: 4 },
    entries: [
      { type: "gold",      weight: 25, count: { base: 40, perDepth: 8 } },
      { type: "equip",     weight: 2,  pool: ["bow_shadow"], affixChance: 0.70, affixCountMax: 2 },
      { type: "equip",     weight: 16, pool: ["nightfang_dagger", "pyreheart_mace", "glacial_edge", "witchfire_sword", "howling_maul", "stormcaller_blade", "soulreaver_axe"], affixChance: 0, affixCountMax: 0 },
      { type: "equip",     weight: 8,  pool: ["pendant_soulkeeper", "pendant_stormward", "belt_ironhide", "belt_vitality", "gloves_arcane", "amulet_vigor", "belt_girded", "gauntlets_iron", "greaves_steel", "ring_health", "ring_precision", "ring_arcana", "ring_endurance"], affixChance: 0.70, affixCountMax: 2 },
      { type: "equip",     weight: 10, pool: ["helm_warhelm", "helm_visionary", "gauntlets_spiked", "ring_of_fury", "serpent_ring", "wardkeeper_shield", "aegis_of_the_ancient", "armor_bulwark", "armor_phantom", "legguards_colossus", "leggings_wraith", "boots_earthbound", "boots_phantomstride", "ring_ironwill", "ring_fateweaver", "ring_voidchannel"], affixChance: 0, affixCountMax: 0 },
      { type: "table",     weight: 25, tableId: "sub:spellbooks" },
      { type: "table",     weight: 20, tableId: "sub:scrolls" },
      { type: "archetype", weight: 18, archetype: "HealthPotion" },
      { type: "item",      weight: 12, itemId: "scroll_identify" },
      { type: "table",     weight: 15, tableId: "sub:wands" },
      { type: "gem",       weight: 4,  materials: ["gemstone"] },
      { type: "table",     weight: 5,  tableId: "sub:equip_catalog_backfill" },
    ],
  },

  // ── Shop stock tables ────────────────────────────────────────────

  "shop:equipment": {
    rolls: { min: 2, max: 4 },
    entries: [
      { type: "table",  weight: 40, tableId: "sub:equip_common" },
      { type: "table",  weight: 30, tableId: "sub:equip_magic" },
      { type: "table",  weight: 8,  tableId: "sub:equip_catalog_backfill" },
      { type: "table",  weight: 15, tableId: "sub:scrolls" },
      { type: "table",  weight: 15, tableId: "sub:spellbooks" },
      { type: "table",  weight: 10, tableId: "sub:wands" },
      { type: "table",  weight: 15, tableId: "sub:food" },
    ],
  },

  // ── Floor loot (replaces pickItem) ────────────────────────────────

  "floor:common": {
    rolls: { min: 1, max: 2 },
    entries: [
      { type: "gold",      weight: 35, count: { base: 6, perDepth: 3 } },
      { type: "table",     weight: 24, tableId: "sub:potions" },
      { type: "item",      weight: 10, itemId: "potion_mana" },
      { type: "table",     weight: 22, tableId: "sub:equip_common" },
      { type: "table",     weight: 10, tableId: "sub:equip_early_proc" },
      { type: "table",     weight: 10, tableId: "sub:equip_magic" },
      { type: "table",     weight: 5,  tableId: "sub:equip_rare" },
      { type: "table",     weight: 2,  tableId: "sub:equip_epic" },
      { type: "table",     weight: 1,  tableId: "sub:equip_legendary" },
      { type: "table",     weight: 3,  tableId: "sub:equip_catalog_backfill" },
      { type: "archetype", weight: 18, archetype: "ArrowsStack" },
      { type: "archetype", weight: 10, archetype: "FireArrowsStack" },
      { type: "archetype", weight: 8,  archetype: "PiercingArrowsStack" },
      { type: "archetype", weight: 6,  archetype: "BodkinArrowsStack" },
      { type: "archetype", weight: 6,  archetype: "BluntHeadArrowsStack" },
      { type: "table",     weight: 12, tableId: "sub:spellbooks" },
      { type: "table",     weight: 8,  tableId: "sub:scrolls" },
      { type: "table",     weight: 6,  tableId: "sub:wands" },
      { type: "archetype", weight: 8,  archetype: "Ration" },
      { type: "gem",       weight: 2,  materials: ["gemstone", "glass"] },
      { type: "table",     weight: 4,  tableId: "sub:jewelry_cursed" },
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
      { type: "gem",       weight: 2,  materials: ["gemstone", "glass"] },
      { type: "table",     weight: 3,  tableId: "sub:jewelry_cursed" },
      { type: "table",     weight: 4,  tableId: "sub:equip_rare" },
      { type: "table",     weight: 2,  tableId: "sub:equip_epic" },
      { type: "table",     weight: 1,  tableId: "sub:equip_legendary" },
      { type: "table",     weight: 3,  tableId: "sub:equip_catalog_backfill" },
    ],
  },

  // ── Urn contents ─────────────────────────────────────────────────
  // Breaking an urn scatters someone's ashes. Occasionally jewelry was
  // interred with the deceased; rarely a gemstone settled to the bottom.

  "urn:contents": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "nothing",  weight: 10 },
      { type: "table",    weight: 18, tableId: "sub:jewelry" },
      { type: "gem",      weight: 7,  materials: ["gemstone"] },
    ],
  },

  // ── Sarcophagus contents ─────────────────────────────────────────
  // Burial goods interred with the deceased. Richer than urns:
  // bones, a burial weapon, jewelry, and a generous helping of gems.
  // No worthless glass — that would be an affront to the dead.

  "sub:sarc_weapon": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "equip", weight: 25, pool: ["sword_plain", "dagger_quick"], affixChance: 0.30, affixCountMax: 1 },
      { type: "equip", weight: 20, pool: ["longsword", "axe_heavy"],     affixChance: 0.35, affixCountMax: 1 },
      { type: "equip", weight: 16, pool: ["morningstar"],                affixChance: 0.30, affixCountMax: 1 },
      { type: "equip", weight: 15, pool: ["warhammer"],                  affixChance: 0, affixCountMax: 0 },
      { type: "equip", weight: 10, pool: ["flail"],                      affixChance: 0, affixCountMax: 0 },
      { type: "equip", weight: 10, pool: ["nightfang_dagger", "flametongue"], affixChance: 0 },
      { type: "equip", weight: 5,  pool: ["pyreheart_mace", "glacial_edge"], affixChance: 0 },
    ],
  },

  "sarcophagus:contents": {
    rolls: { min: 2, max: 4 },
    entries: [
      { type: "archetype", weight: 30, archetype: "Bone" },
      { type: "table",     weight: 22, tableId: "sub:sarc_weapon" },
      { type: "table",     weight: 25, tableId: "sub:jewelry" },
      { type: "table",     weight: 8,  tableId: "sub:jewelry_cursed" },
      { type: "gem",       weight: 20, materials: ["gemstone"] },
      { type: "gold",      weight: 15, count: { base: 10, perDepth: 5 } },
    ],
  },

  // ── Weapon rack tables ────────────────────────────────────────────
  // 1 item; "nothing" entries model empty racks.

  "rack:weapons": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "nothing", weight: 10 },
      { type: "equip",   weight: 25, pool: ["sword_plain"],   affixChance: 0.25, affixCountMax: 1 },
      { type: "equip",   weight: 25, pool: ["dagger_quick"],  affixChance: 0.25, affixCountMax: 1 },
      { type: "equip",   weight: 20, pool: ["axe_heavy"],     affixChance: 0.30, affixCountMax: 1 },
      { type: "equip",   weight: 20, pool: ["bow_short", "bow_recurve"], affixChance: 0.25, affixCountMax: 1 },
      { type: "equip",   weight: 12, pool: ["bow_long"],      affixChance: 0.30, affixCountMax: 1 },
      { type: "equip",   weight: 18, pool: ["iron_mace"],     affixChance: 0, affixCountMax: 0 },
      { type: "equip",   weight: 14, pool: ["morningstar"],   affixChance: 0.25, affixCountMax: 1 },
      { type: "equip",   weight: 15, pool: ["longsword"],     affixChance: 0.30, affixCountMax: 1 },
      { type: "equip",   weight: 10, pool: ["iron_pickaxe"],  affixChance: 0.25, affixCountMax: 1 },
      { type: "table",   weight: 10, tableId: "sub:equip_magic" },
      { type: "table",   weight: 4,  tableId: "sub:equip_rare" },
      { type: "table",   weight: 2,  tableId: "sub:equip_epic" },
      { type: "table",   weight: 1,  tableId: "sub:equip_legendary" },
    ],
  },

  "rack:weapons:magic": {
    rolls: { min: 1, max: 1 },
    entries: [
      { type: "nothing", weight: 8 },
      { type: "equip",   weight: 22, pool: ["longsword"],         affixChance: 0.50, affixCountMax: 1 },
      { type: "equip",   weight: 20, pool: ["axe_heavy"],         affixChance: 0.45, affixCountMax: 1 },
      { type: "equip",   weight: 18, pool: ["warhammer"],         affixChance: 0, affixCountMax: 0 },
      { type: "equip",   weight: 16, pool: ["flail"],             affixChance: 0, affixCountMax: 0 },
      { type: "equip",   weight: 7,  pool: ["bow_long"],          affixChance: 0.45, affixCountMax: 1 },
      { type: "equip",   weight: 7,  pool: ["bow_flaming"],       affixChance: 0, affixCountMax: 0 },
      { type: "equip",   weight: 16, pool: ["venomfang_dagger"],  affixChance: 0.35, affixCountMax: 1 },
      { type: "equip",   weight: 14, pool: ["caustic_stiletto"],  affixChance: 0 },
      { type: "equip",   weight: 12, pool: ["stormtouched_mace"], affixChance: 0 },
      { type: "table",   weight: 10, tableId: "sub:equip_rare" },
      { type: "table",   weight: 5,  tableId: "sub:equip_epic" },
      { type: "table",   weight: 2,  tableId: "sub:equip_legendary" },
    ],
  },
};

export function getTable(id) { return /** @type {any} */ (LOOT_TABLES)[id] || null; }
