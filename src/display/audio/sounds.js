// Sound registry — maps sound IDs to audio file paths and default playback options.
// All paths are relative to site root.
// Add .wav / .mp3 / .mp4 files to assets/audio/ and register them here.

const BASE = "./assets/audio/";

/**
 * Each entry:  id → { file, volume?, rate?, detune? }
 *
 * `file` is the filename inside assets/audio/.
 * Optional defaults can be overridden per-play in audioWiring.
 */
const SOUNDS = {
  // ── Combat ──────────────────────────────────────
  "melee:hit":        { file: "melee_hit.wav" },
  "melee:crit":       { file: "melee_crit.wav" },
  "melee:miss":       { file: "melee_miss.wav" },
  "ranged:shot":      { file: "ranged_shot.wav" },
  "death":            { file: "death.wav" },

  // ── Items ───────────────────────────────────────
  "item:pickup":      { file: "item_pickup.wav" },
  "item:drop":        { file: "item_drop.wav" },
  "item:equip":       { file: "item_equip.wav" },
  "chest:open":       { file: "chest_open.wav" },

  // ── Environment ─────────────────────────────────
  "stair:descend":    { file: "stair_descend.wav" },
  "stair:ascend":     { file: "stair_ascend.wav" },
  "door:open":        { file: "door_open.wav" },
  "fountain":         { file: "fountain.wav" },

  // ── Spells ──────────────────────────────────────
  "spell:bolt":          { file: "spell_bolt.wav" },
  "spell:frost":         { file: "spell_frost.wav" },
  "spell:shadow_bolt":   { file: "spell_shadow_bolt.wav" },
  "spell:fireball":      { file: "spell_fireball.wav" },
  "spell:meteor":        { file: "spell_meteor.wav" },
  "spell:blizzard":      { file: "spell_blizzard.wav" },
  "spell:firestorm":     { file: "spell_firestorm.wav" },
  "spell:blastwave":     { file: "spell_blastwave.wav" },
  "spell:flash_heal":    { file: "spell_heal.wav" },
  "spell:smite":         { file: "spell_smite.wav" },
  "spell:death_volley":  { file: "spell_death_volley.wav" },
  "spell:blink":         { file: "spell_blink.wav" },
  "spell:plague_swarm":  { file: "spell_plague_swarm.wav" },
  "spell:earthshatter":  { file: "spell_earthshatter.wav" },
  "spell:war_cry":       { file: "spell_war_cry.wav" },
  "spell:cleave":        { file: "spell_cleave.wav" },
  "spell:rampage":       { file: "spell_rampage.wav" },
  "spell:phase_strike":  { file: "spell_phase_strike.wav" },
  "spell:shield_bash":   { file: "spell_shield_bash.wav" },
  "spell:wolf_howl":     { file: "spell_wolf_howl.wav" },
  "spell:boar_charge":   { file: "spell_boar_charge.wav" },
  "spell:consecrate":    { file: "spell_consecrate.wav" },
  "spell:divine_shield": { file: "spell_divine_shield.wav" },
  "spell:purify":        { file: "spell_purify.wav" },
  "spell:bloodthirst":   { file: "spell_bloodthirst.wav" },
  "spell:verdant_ward":  { file: "spell_verdant_ward.wav" },
  "spell:harmony_ward":  { file: "spell_harmony_ward.wav" },
  "spell:shadow_veil":   { file: "spell_shadow_veil.wav" },
  "spell:smoke_bomb":    { file: "spell_smoke_bomb.wav" },
  "spell:poison_blade":  { file: "spell_poison_blade.wav" },
  "spell:lifetap":       { file: "spell_lifetap.wav" },
  "spell:acid_spit":     { file: "spell_acid_spit.wav" },
  "spell:web_spit":      { file: "spell_web_spit.wav" },
  "spell:fizzle":        { file: "spell_fizzle.wav" },

  // ── Weather ─────────────────────────────────────
  "thunder":          { file: "thunder.wav" },
  "rain:loop":        { file: "rain_loop.wav" },

  // ── UI / Misc ───────────────────────────────────
  "level:up":         { file: "level_up.wav" },
  "player:death":     { file: "player_death.wav" },
};

/**
 * Resolve a sound ID to its full URL and default options.
 * @param {string} id
 * @returns {{ url: string, volume?: number, rate?: number, detune?: number } | null}
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
