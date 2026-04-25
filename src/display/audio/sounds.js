// Sound registry — maps sound IDs to audio file paths, bus routing, and playback defaults.
//
// Buses:       combat | spells | items | ambient | ui
// maxVoices:   how many of this sound can play at once (default 3)
// randomPitch: cents of random detune jitter per play — opt-in, set after hearing the files

const BASE = "./assets/audio/";

/**
 * Each entry:  id → { file|files, bus, maxVoices?, volume?, rate?, detune?, randomPitch? }
 */
const SOUNDS = {
  // ── Combat ──────────────────────────────────────
  "melee:hit":        { file: "melee_hit.wav",     bus: "combat", randomPitch: 55 },
  "shield:blocked":   { files: ["melee_shield_hit_1.mp3", "melee_shield_hit_2.mp3", "melee_shield_hit_3.mp3", "melee_shield_hit_4.mp3", "melee_shield_hit_5.mp3", "melee_shield_hit_6.mp3"], bus: "combat", randomPitch: 45 },
  "melee:crit":       { file: "melee_crit.wav",    bus: "combat", randomPitch: 40 },
  "melee:miss":       { file: "melee_miss.wav",    bus: "combat" },
  "ranged:shot":      { file: "ranged_shot.wav",   bus: "combat", randomPitch: 35 },
  "death":            { file: "death.wav",          bus: "combat", maxVoices: 3 },
  "creature:boar:died": { file: "boar_died.mp3",      bus: "combat", maxVoices: 1 },
  "player:death":     { file: "player_death.wav",   bus: "combat", maxVoices: 1 },
  "player:death:heavy": { file: "player_death_2.wav", bus: "combat", maxVoices: 1 },

  // ── Items (by type) ─────────────────────────────
  "item:pickup:weapon":    { file: "pickup_weapon.wav",   bus: "items" },
  "item:pickup:armor":     { file: "pickup_armor.wav",    bus: "items" },
  "item:pickup:potion":    { file: "pickup_potion.wav",   bus: "items" },
  "item:pickup:scroll":    { file: "pickup_scroll.wav",   bus: "items" },
  "item:pickup:gold":      { file: "pickup_gold.wav",     bus: "items" },
  "item:pickup:food":      { file: "pickup_food.wav",     bus: "items" },
  "item:pickup:gem":       { file: "pickup_gem.wav",      bus: "items" },
  "item:pickup:generic":   { file: "pickup_generic.wav",  bus: "items" },

  "item:drop:weapon":      { file: "drop_weapon.wav",     bus: "items" },
  "item:drop:weapon:metal": { file: "drop_weapon_metal.mp3", bus: "items" },
  "item:drop:armor":       { file: "drop_armor.wav",      bus: "items" },
  "item:drop:potion":      { file: "drop_potion.wav",     bus: "items" },
  "item:impact:potion":    { file: "impact_potion.wav",   bus: "items", maxVoices: 4 },
  "item:drop:gem":         { file: "drop_gem.wav",        bus: "items" },
  "item:drop:bone":        { file: "bone_dropped.mp3",    bus: "items", maxVoices: 3 },
  "item:drop:gem:glass":   { file: "drop_gem_lesser.wav", bus: "items" },
  "item:drop:generic":     { file: "drop_generic.wav",    bus: "items" },

  "item:equip:weapon":     { file: "equip_weapon.wav",    bus: "items" },
  "item:equip:armor":      { file: "equip_armor.wav",     bus: "items" },
  "item:equip:generic":    { file: "equip_generic.wav",   bus: "items" },

  "chest:open":            { file: "chest_open.wav",      bus: "items" },
  "item:chest:opened":     { file: "chest_opened.mp3",    bus: "items" },

  // ── Environment ─────────────────────────────────
  "stair:descend":    { file: "transition_coating.mp3", bus: "ambient" },
  "stair:ascend":     { file: "transition_coating.mp3", bus: "ambient" },
  "door:open":        { file: "door_open.mp3",     bus: "ambient" },
  "door:close":       { file: "door_close.mp3",    bus: "ambient" },
  "fountain":         { file: "ambient_fountain.mp3",      bus: "ambient" },
  "church:bell":      { file: "ambient_church_bells.mp3",  bus: "ambient", maxVoices: 1 },
  "ambient:church":   { file: "ambient_church_inside.mp3", bus: "ambient" },
  "ambient:cooking_fire": { file: "ambient_cooking_fire.mp3", bus: "ambient" },
  "ambient:holy_site": { file: "ambient_holy_site.mp3",    bus: "ambient" },
  "ambient:smithy":   { file: "ambient_smithy.mp3",        bus: "ambient" },
  "ambient:torch_flames": { file: "ambient_torch_flames.mp3", bus: "ambient" },
  "ambient:town":     { file: "ambient_town.mp3",          bus: "ambient", volume: 0.7 },
  "ambient:tavern":   { file: "ambient_tavern.mp3",        bus: "ambient" },
  "ambient:ocean":    { file: "biome_ocean_loop.mp3",      bus: "ambient" },
  "ambient:swamp":    { files: ["biome_swamp_loop.mp3", "ambient_swamp.mp3"], bus: "ambient" },
  "ambient:forest":   { files: ["ambient_forest_1.mp3", "ambient_forest_2.mp3"], bus: "ambient" },
  "ambient:meadow":   { file: "ambient_meadow_1.mp3",      bus: "ambient" },
  "ambient:dungeon":  { files: ["ambient_dungeon_1.mp3", "ambient_dungeon_2.mp3"], bus: "ambient" },
  "ambient:omen":     { file: "ambient_dungeon_omen.mp3",  bus: "ambient", maxVoices: 1 },
  "ambient:chick":    { file: "chick.mp3",                 bus: "ambient", maxVoices: 4, volume: 0.35 },
  "ambient:chicken":  { file: "chicken.mp3",               bus: "ambient", maxVoices: 4, volume: 0.35 },
  "character:select":  { file: "character_select.mp3",      bus: "ui", maxVoices: 1 },
  "enter:world":       { file: "enter_world.mp3",           bus: "ui", maxVoices: 1 },
  "snake:alert":      { file: "snake_alerted.mp3",         bus: "combat", maxVoices: 2, randomPitch: 18 },
  "spider:alert":     { file: "spider_alerted.mp3",        bus: "combat", maxVoices: 2, randomPitch: 20 },
  "cave_bear:alert":  { file: "creature_alerted_large_beast.mp3",     bus: "combat", maxVoices: 2, randomPitch: 15 },
  "rat:alert":        { file: "rat_alerted_1.mp3",         bus: "combat", maxVoices: 3, randomPitch: 25 },
  "creature:alert:large_beast": { file: "creature_alerted_large_beast.mp3", bus: "combat", maxVoices: 2, randomPitch: 15 },
  "deity:omen":       { file: "harp_reverb.wav",   bus: "ambient", maxVoices: 2 },

  // ── Spells (cast / launch) ─────────────────────
  "spell:bolt":          { file: "spell_bolt.wav",          bus: "spells" },
  "spell:frost":         { file: "spell_frost.wav",         bus: "spells" },
  "spell:shadow_bolt":   { file: "spell_shadow_bolt.wav",   bus: "spells" },
  "spell:fireball":      { files: ["spell_fire.mp3", "spell_fireball.mp3"], bus: "spells" },
  "spell:meteor":        { file: "spell_meteor.wav",        bus: "spells" },
  "spell:blizzard":      { file: "spell_blizzard.wav",      bus: "spells" },
  "spell:firestorm":     { file: "spell_firestorm.wav",     bus: "spells" },
  "spell:blastwave":     { file: "spell_blastwave.wav",     bus: "spells" },
  "spell:flash_heal":    { file: "spell_heal.wav",          bus: "spells" },
  "spell:smite":         { file: "spell_smite.wav",         bus: "spells" },
  "spell:death_volley":  { file: "spell_death_volley.wav",  bus: "spells" },
  "spell:blink":         { file: "spell_blink.wav",         bus: "spells" },
  "spell:plague_swarm":  { file: "spell_plague_swarm.mp3",  bus: "spells" },
  "spell:earthshatter":  { file: "spell_earthshatter.wav",  bus: "spells" },
  "spell:war_cry":       { file: "spell_war_cry.wav",       bus: "spells" },
  "spell:cleave":        { file: "spell_cleave.wav",        bus: "spells" },
  "spell:rampage":       { file: "spell_rampage.wav",       bus: "spells" },
  "spell:phase_strike":  { file: "spell_phase_strike.wav",  bus: "spells" },
  "spell:shield_bash":   { file: "spell_shield_bash.wav",   bus: "spells" },
  "spell:wolf_howl":     { files: ["spell_wolf_howl.wav", "spell_wolf_howl.mp3"], bus: "spells" },
  "spell:boar_charge":   { file: "boar_charge.mp3",         bus: "spells" },
  "spell:consecrate":    { file: "spell_consecrate.wav",    bus: "spells" },
  "spell:divine_shield": { file: "spell_buff.mp3",          bus: "spells" },
  "spell:purify":        { file: "spell_purify.wav",        bus: "spells" },
  "spell:bloodthirst":   { file: "spell_bloodthirst.wav",   bus: "spells" },
  "spell:verdant_ward":  { file: "spell_buff.mp3",          bus: "spells" },
  "spell:harmony_ward":  { file: "spell_buff.mp3",          bus: "spells" },
  "spell:shadow_veil":   { file: "spell_shadow_veil.wav",   bus: "spells" },
  "spell:smoke_bomb":    { files: ["spell_smoke_bomb.wav", "spell_smoke_bomb.mp3"], bus: "spells" },
  "spell:poison_blade":  { file: "spell_poison_blade.wav",  bus: "spells" },
  "spell:lifetap":       { file: "spell_lifetap.wav",       bus: "spells" },
  "spell:acid_spit":     { files: ["spell_acid_spit.wav", "spell_acid_spit.mp3"], bus: "spells" },
  "spell:web_spit":      { files: ["spider_attack_web_1.mp3", "spider_attack_web_2.mp3"], bus: "spells", randomPitch: 20 },
  "spell:spider_lunge":  { files: ["spider_attack_1.mp3", "spider_attack_2.mp3", "spider_attack_3.mp3"], bus: "spells", randomPitch: 25 },
  "spell:entangle":      { file: "spell_entangle.mp3",      bus: "spells" },
  "cave_bear:attack":   { files: ["cave_bear_attack_1.mp3", "cave_bear_attack_2.mp3"], bus: "combat", randomPitch: 30 },
  "rat:attack":         { file: "rat_attack_1.mp3", bus: "combat", maxVoices: 4, randomPitch: 35 },
  "spell:fizzle":        { file: "spell_fizzle.wav",        bus: "spells" },

  // ── Spell travel (in-flight projectile) ────────
  "travel:fire":       { file: "travel_fire.wav",      bus: "spells" },
  "travel:ice":        { file: "travel_ice.wav",       bus: "spells" },
  "travel:lightning":   { file: "travel_lightning.wav",  bus: "spells" },
  "travel:shadow":     { file: "travel_shadow.wav",    bus: "spells" },
  "travel:holy":       { file: "travel_holy.wav",      bus: "spells" },
  "travel:poison":     { file: "travel_poison.wav",    bus: "spells" },
  "travel:arrow":      { file: "travel_arrow.wav",     bus: "combat" },

  // ── Spell impacts (hit after travel) ───────────
  "spell:impact:fire":      { file: "impact_fire.wav",      bus: "spells", maxVoices: 4 },
  "spell:impact:meteor":    { files: ["spell_meteor_impact.mp3", "spell_meteor_impact_2.mp3"], bus: "spells", maxVoices: 3 },
  "spell:impact:ice":       { file: "impact_ice.wav",       bus: "spells", maxVoices: 4 },
  "spell:impact:lightning":  { file: "impact_lightning.wav",  bus: "spells", maxVoices: 4 },
  "spell:impact:shadow":    { file: "impact_shadow.wav",    bus: "spells", maxVoices: 4 },
  "spell:impact:holy":      { file: "impact_holy.wav",      bus: "spells", maxVoices: 4 },
  "spell:impact:poison":    { file: "impact_poison.wav",    bus: "spells", maxVoices: 4 },
  "spell:impact:physical":  { file: "impact_physical.wav",  bus: "spells", maxVoices: 4 },

  // ── Weather ─────────────────────────────────────
  "thunder":          { file: "weather_lightning_strike.mp3",          bus: "ambient", maxVoices: 2 },
  "thunder:distant":  { file: "weather_lightning_strike_distant.mp3",  bus: "ambient", maxVoices: 2 },
  "rain:loop":        { file: "weather_rain.mp3",                      bus: "ambient" },

  // ── Crafting / Smithy ───────────────────────────
  "smithy:anvil:hit": { files: ["anvil_hit_1.mp3", "anvil_hit_2.mp3"], bus: "ambient", maxVoices: 3, randomPitch: 40 },

  // ── Status Effects ──────────────────────────────
  "status:electrocuted": { file: "status_electrocuted.mp3", bus: "combat", maxVoices: 1 },
  "status:slimed":       { file: "status_slimed.mp3",       bus: "combat", maxVoices: 1 },
  "status:deafened":     { files: ["status_deafened.mp3", "status_deafened_2.mp3"], bus: "ui", maxVoices: 1 },
  "status:frozen":       { files: ["status_frozen_1.mp3", "status_frozen_2.mp3", "status_frozen_3.mp3", "status_frozen_4.mp3", "status_frozen_5.mp3"], bus: "combat", maxVoices: 1 },

  // ── Interactions ────────────────────────────────
  "fountain:sip":     { file: "fountain_sip.mp3",    bus: "items" },
  "item:consume:food": { file: "eat_food.mp3",       bus: "items" },
  "torch:ignite":     { file: "light_fire.mp3",      bus: "ambient" },
  "shop:enter":       { file: "shop_door_chime.mp3", bus: "ui", maxVoices: 1 },
  "quest:completed":  { file: "quest_complete.mp3",  bus: "ui", maxVoices: 1 },

  // ── Creatures (vocalizations) ───────────────────
  "creature:pet:meow":    { file: "pet_meow_1.mp3",          bus: "ambient", maxVoices: 2 },
  "creature:pet:eating":  { file: "pet_feline_eating.mp3",   bus: "ambient", maxVoices: 2, segment: 2 },

  // ── Soundscapes ─────────────────────────────────
  "soundscape":       { file: "soundscape.mp3",      bus: "ambient" },

  // ── Additional Spell Variants ───────────────────
  "spell:agony":      { file: "spell_agony.mp3",     bus: "spells" },

  // ── UI / Misc ───────────────────────────────────
  "level:up":         { file: "level_up.wav",   bus: "ui", maxVoices: 1 },
};

/**
 * Resolve a sound ID to its full URL and default options.
 * @param {string} id
 * @returns {{ url: string, file: string, files?: string[], bus?: string, maxVoices?: number, randomPitch?: number, volume?: number, rate?: number, detune?: number } | null}
 */
export function resolve(id) {
  const entry = SOUNDS[id];
  if (!entry) return null;
  const files = Array.isArray(entry.files)
    ? entry.files.filter((file) => typeof file === "string" && file.length > 0)
    : [];
  const file = files.length > 0
    ? files[(Math.random() * files.length) | 0]
    : entry.file;
  if (typeof file !== "string" || file.length <= 0) return null;
  return { ...entry, file, files: files.length > 0 ? files : undefined, url: BASE + file };
}

/** All registered file URLs — for preloading. */
export function allUrls() {
  return Object.values(SOUNDS).flatMap((entry) => {
    if (Array.isArray(entry.files) && entry.files.length > 0) {
      return entry.files.map((file) => BASE + file);
    }
    return entry.file ? [BASE + entry.file] : [];
  });
}

/** All registered sound IDs. */
export function allIds() {
  return Object.keys(SOUNDS);
}
