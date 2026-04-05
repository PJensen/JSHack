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
  "spell:bolt":       { file: "spell_bolt.wav" },
  "spell:area":       { file: "spell_area.wav" },
  "spell:heal":       { file: "spell_heal.wav" },
  "spell:fizzle":     { file: "spell_fizzle.wav" },

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
