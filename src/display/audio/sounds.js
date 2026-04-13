// Sound registry — maps sound IDs to audio file paths, bus routing, and playback defaults.
//
// Buses:       combat | spells | items | ambient | ui
// maxVoices:   how many of this sound can play at once (default 3)
// randomPitch: cents of random detune jitter per play — opt-in, set after hearing the files

const BASE = "./assets/audio/";

/**
 * Each entry:  id → { file, bus, maxVoices?, volume?, rate?, detune?, randomPitch? }
 */
const SOUNDS = {
  // ── Combat ──────────────────────────────────────
  "melee:hit":        { file: "melee_hit.wav",     bus: "combat", randomPitch: 55 },
  "melee:crit":       { file: "melee_crit.wav",    bus: "combat", randomPitch: 40 },
  "melee:miss":       { file: "melee_miss.wav",    bus: "combat" },
  "ranged:shot":      { file: "ranged_shot.wav",   bus: "combat", randomPitch: 35 },
  "death":            { file: "death.wav",          bus: "combat", maxVoices: 3 },
  "player:death":     { file: "player_death.wav",   bus: "combat", maxVoices: 1 },

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
  "item:drop:armor":       { file: "drop_armor.wav",      bus: "items" },
  "item:drop:potion":      { file: "drop_potion.wav",     bus: "items" },
  "item:drop:generic":     { file: "drop_generic.wav",    bus: "items" },

  "item:equip:weapon":     { file: "equip_weapon.wav",    bus: "items" },
  "item:equip:armor":      { file: "equip_armor.wav",     bus: "items" },
  "item:equip:generic":    { file: "equip_generic.wav",   bus: "items" },

  "chest:open":            { file: "chest_open.wav",      bus: "items" },

  // ── Environment ─────────────────────────────────
  "stair:descend":    { file: "stair_descend.wav", bus: "ambient" },
  "stair:ascend":     { file: "stair_ascend.wav",  bus: "ambient" },
  "door:open":        { file: "door_open.wav",     bus: "ambient" },
  "fountain":         { file: "fountain.wav",      bus: "ambient" },

  // ── Spells (cast / launch) ─────────────────────
  "spell:bolt":          { file: "spell_bolt.wav",          bus: "spells" },
  "spell:frost":         { file: "spell_frost.wav",         bus: "spells" },
  "spell:shadow_bolt":   { file: "spell_shadow_bolt.wav",   bus: "spells" },
  "spell:fireball":      { file: "spell_fireball.wav",      bus: "spells" },
  "spell:meteor":        { file: "spell_meteor.wav",        bus: "spells" },
  "spell:blizzard":      { file: "spell_blizzard.wav",      bus: "spells" },
  "spell:firestorm":     { file: "spell_firestorm.wav",     bus: "spells" },
  "spell:blastwave":     { file: "spell_blastwave.wav",     bus: "spells" },
  "spell:flash_heal":    { file: "spell_heal.wav",          bus: "spells" },
  "spell:smite":         { file: "spell_smite.wav",         bus: "spells" },
  "spell:death_volley":  { file: "spell_death_volley.wav",  bus: "spells" },
  "spell:blink":         { file: "spell_blink.wav",         bus: "spells" },
  "spell:plague_swarm":  { file: "spell_plague_swarm.wav",  bus: "spells" },
  "spell:earthshatter":  { file: "spell_earthshatter.wav",  bus: "spells" },
  "spell:war_cry":       { file: "spell_war_cry.wav",       bus: "spells" },
  "spell:cleave":        { file: "spell_cleave.wav",        bus: "spells" },
  "spell:rampage":       { file: "spell_rampage.wav",       bus: "spells" },
  "spell:phase_strike":  { file: "spell_phase_strike.wav",  bus: "spells" },
  "spell:shield_bash":   { file: "spell_shield_bash.wav",   bus: "spells" },
  "spell:wolf_howl":     { file: "spell_wolf_howl.wav",     bus: "spells" },
  "spell:boar_charge":   { file: "spell_boar_charge.wav",   bus: "spells" },
  "spell:consecrate":    { file: "spell_consecrate.wav",    bus: "spells" },
  "spell:divine_shield": { file: "spell_divine_shield.wav", bus: "spells" },
  "spell:purify":        { file: "spell_purify.wav",        bus: "spells" },
  "spell:bloodthirst":   { file: "spell_bloodthirst.wav",   bus: "spells" },
  "spell:verdant_ward":  { file: "spell_verdant_ward.wav",  bus: "spells" },
  "spell:harmony_ward":  { file: "spell_harmony_ward.wav",  bus: "spells" },
  "spell:shadow_veil":   { file: "spell_shadow_veil.wav",   bus: "spells" },
  "spell:smoke_bomb":    { file: "spell_smoke_bomb.wav",    bus: "spells" },
  "spell:poison_blade":  { file: "spell_poison_blade.wav",  bus: "spells" },
  "spell:lifetap":       { file: "spell_lifetap.wav",       bus: "spells" },
  "spell:acid_spit":     { file: "spell_acid_spit.wav",     bus: "spells" },
  "spell:web_spit":      { file: "spell_web_spit.wav",      bus: "spells" },
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
  "spell:impact:ice":       { file: "impact_ice.wav",       bus: "spells", maxVoices: 4 },
  "spell:impact:lightning":  { file: "impact_lightning.wav",  bus: "spells", maxVoices: 4 },
  "spell:impact:shadow":    { file: "impact_shadow.wav",    bus: "spells", maxVoices: 4 },
  "spell:impact:holy":      { file: "impact_holy.wav",      bus: "spells", maxVoices: 4 },
  "spell:impact:poison":    { file: "impact_poison.wav",    bus: "spells", maxVoices: 4 },
  "spell:impact:physical":  { file: "impact_physical.wav",  bus: "spells", maxVoices: 4 },

  // ── Weather ─────────────────────────────────────
  "thunder":          { file: "thunder.wav",    bus: "ambient", maxVoices: 2 },
  "rain:loop":        { file: "rain_loop.wav",  bus: "ambient" },

  // ── UI / Misc ───────────────────────────────────
  "level:up":         { file: "level_up.wav",   bus: "ui", maxVoices: 1 },
};

/**
 * Resolve a sound ID to its full URL and default options.
 * @param {string} id
 * @returns {{ url: string, bus?: string, maxVoices?: number, randomPitch?: number, volume?: number, rate?: number, detune?: number } | null}
 */
export function resolve(id) {
  const entry = SOUNDS[id];
  if (!entry) return null;
  return { ...entry, url: BASE + entry.file };
}

/** All registered file URLs — for preloading. */
export function allUrls() {
  return Object.values(SOUNDS).map(e => BASE + e.file);
}

/** All registered sound IDs. */
export function allIds() {
  return Object.keys(SOUNDS);
}
