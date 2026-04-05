// Wires ECS world events to audio playback.
// Listens to game events and plays the matching sound from the registry.
//
// Spatial audio: sounds with a known {x,y} source are panned L/R and
// attenuated by distance from the player. Sounds through walls are muffled.

import { play, preload, startLoop, stopLoop, setReverbMix } from "./audioEngine.js";
import { resolve, allUrls } from "./sounds.js";

// ── Spatial helpers ─────────────────────────────────────────

/** Max tile distance at which a sound is still audible. Beyond this → silent. */
const MAX_HEAR_DIST = 16;

/**
 * Compute pan (-1…+1) and volume (0…1) from source position relative to player.
 * @param {{ x: number, y: number }} sourcePos
 * @param {{ x: number, y: number }} playerPos
 * @returns {{ pan: number, volume: number }}
 */
function spatialize(sourcePos, playerPos) {
  if (!sourcePos || !playerPos) return { pan: 0, volume: 1 };

  const dx = sourcePos.x - playerPos.x;
  const dy = sourcePos.y - playerPos.y;
  const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));

  if (dist > MAX_HEAR_DIST) return { pan: 0, volume: 0 };

  // Volume: inverse-distance falloff, full at dist<=1, fading to 0.15 at MAX_HEAR_DIST
  const volume = Math.max(0.15, 1.0 - (dist - 1) / MAX_HEAR_DIST);

  // Pan: horizontal offset clamped to -1…+1, scaled so ~8 tiles = full pan
  const pan = Math.max(-1, Math.min(1, dx / 8));

  return { pan, volume };
}

// ── Sound playback helpers ──────────────────────────────────

/** Play a registered sound with optional spatial + overrides. */
function sfx(id, opts) {
  const s = resolve(id);
  if (!s) return;
  play(s.url, {
    bus: s.bus, maxVoices: s.maxVoices, randomPitch: s.randomPitch,
    volume: s.volume, rate: s.rate, detune: s.detune,
    ...opts,
  });
}

/** Play a registered sound positioned in world space. */
function sfxAt(id, sourcePos, playerPos, extraOpts) {
  const spatial = spatialize(sourcePos, playerPos);
  if (spatial.volume <= 0) return; // too far, don't play
  sfx(id, { pan: spatial.pan, volume: spatial.volume, ...extraOpts });
}

/**
 * Resolve an item entity's type to a sound category.
 */
function itemCategory(getItemInfo, itemId) {
  const info = getItemInfo(itemId);
  if (!info) return "generic";
  const t = info.type;
  if (t === "weapon") return "weapon";
  if (t === "armor" || t === "shield" || t === "helmet" || t === "boots" || t === "gloves") return "armor";
  if (t === "potion") return "potion";
  if (t === "scroll") return "scroll";
  if (t === "gold" || t === "coin") return "gold";
  if (t === "food" || t === "corpse") return "food";
  if (t === "gem") return "gem";
  return "generic";
}

/**
 * Map a spell damage type to an impact sound category.
 */
const SPELL_IMPACT_MAP = {
  fire:      "spell:impact:fire",
  ice:       "spell:impact:ice",
  cold:      "spell:impact:ice",
  electric:  "spell:impact:lightning",
  lightning: "spell:impact:lightning",
  shadow:    "spell:impact:shadow",
  necrotic:  "spell:impact:shadow",
  holy:      "spell:impact:holy",
  radiant:   "spell:impact:holy",
  poison:    "spell:impact:poison",
  acid:      "spell:impact:poison",
};

/**
 * Install audio event listeners on the ECS world.
 * Call once during display setup.
 *
 * @param {{
 *   world: object,
 *   isPlayer: (id: number) => boolean,
 *   getItemInfo: (id: number) => object|null,
 *   getPlayerPosition: () => { x: number, y: number } | null,
 *   getPosition: (id: number) => { x: number, y: number } | null,
 *   getDepth: () => number,
 * }} deps
 */
export function installAudioWiring({ world, isPlayer, getItemInfo, getPlayerPosition, getPosition, getDepth }) {

  // ── Preload all registered sounds ─────────────────────────
  preload(allUrls());

  /** Shorthand — current player pos for spatial calcs. */
  function pp() { return getPlayerPosition(); }

  // ── Combat ────────────────────────────────────────────────

  world.on('damaged', ({ cause, critical, type, at, target }) => {
    const pos = at || (target != null ? getPosition(target) : null);
    if (cause === 'melee' || cause === 'offhand') {
      sfxAt(critical ? "melee:crit" : "melee:hit", pos, pp());
    }
    if (cause === 'spell' || cause === 'magic') {
      const impactId = SPELL_IMPACT_MAP[type] || "spell:impact:physical";
      sfxAt(impactId, pos, pp());
    }
  });

  world.on('hit', (ctx) => {
    if (ctx.missed) {
      const pos = ctx.at || (ctx.target != null ? getPosition(ctx.target) : null);
      sfxAt("melee:miss", pos, pp());
    }
  });

  world.on('ranged:shot', ({ attacker, target }) => {
    const pos = attacker != null ? getPosition(attacker) : null;
    sfxAt("ranged:shot", pos, pp());
  });

  world.on('died', ({ id }) => {
    const pos = getPosition(id);
    if (isPlayer(id)) {
      sfx("player:death"); // player death is always full volume center
    } else {
      sfxAt("death", pos, pp());
    }
  });

  // ── Items (sound varies by item type) ─────────────────────

  world.on('item:pickup', ({ itemId, itemX, itemY }) => {
    const cat = itemCategory(getItemInfo, itemId);
    const pos = (itemX != null && itemY != null) ? { x: itemX, y: itemY } : null;
    sfxAt(`item:pickup:${cat}`, pos, pp());
  });

  world.on('item:dropped', ({ itemId, at }) => {
    const cat = itemCategory(getItemInfo, itemId);
    const dropId = (cat === "weapon" || cat === "armor" || cat === "potion")
      ? `item:drop:${cat}`
      : "item:drop:generic";
    sfxAt(dropId, at, pp());
  });

  world.on('item:equipped', ({ itemId }) => {
    const cat = itemCategory(getItemInfo, itemId);
    const equipId = (cat === "weapon" || cat === "armor")
      ? `item:equip:${cat}`
      : "item:equip:generic";
    sfx(equipId); // equip is always the player — center, full vol
  });

  world.on('chest:open', ({ targetId }) => {
    const pos = targetId != null ? getPosition(targetId) : null;
    sfxAt("chest:open", pos, pp());
  });

  // ── Environment ───────────────────────────────────────────

  world.on('stair:traverse', ({ direction }) => {
    sfx(direction === 'up' ? "stair:ascend" : "stair:descend");
  });

  // ── Spells (cast / launch sounds) ─────────────────────────
  // Each spell gets its own sound on cast. Impact sounds fire
  // separately via the 'damaged' handler above when the spell
  // actually hits after travel time.

  const spellEvents = [
    'spell:bolt',
    'spell:frost',
    'spell:shadow_bolt',
    'spell:fireball',
    'spell:meteor',
    'spell:blizzard',
    'spell:firestorm',
    'spell:blastwave',
    'spell:flash_heal',
    'spell:smite',
    'spell:death_volley',
    'spell:blink',
    'spell:plague_swarm',
    'spell:earthshatter',
    'spell:war_cry',
    'spell:cleave',
    'spell:rampage',
    'spell:phase_strike',
    'spell:shield_bash',
    'spell:wolf_howl',
    'spell:boar_charge',
    'spell:consecrate',
    'spell:divine_shield',
    'spell:purify',
    'spell:bloodthirst',
    'spell:verdant_ward',
    'spell:harmony_ward',
    'spell:shadow_veil',
    'spell:smoke_bomb',
    'spell:poison_blade',
    'spell:lifetap',
    'spell:acid_spit',
    'spell:web_spit',
  ];

  for (const ev of spellEvents) {
    world.on(ev, (payload) => {
      // Spells carry origin info in various fields
      const pos = payload?.at || payload?.origin || payload?.from || null;
      sfxAt(ev, pos, pp());
    });
  }

  // ── Weather ───────────────────────────────────────────────

  const rainUrl = resolve("rain:loop")?.url;

  world.on('weather:changed', ({ weather }) => {
    if ((weather === 'rain' || weather === 'heavy_rain') && rainUrl) {
      const vol = weather === 'heavy_rain' ? 0.7 : 0.4;
      startLoop(rainUrl, { volume: vol, fadeIn: 2.0, bus: "ambient" });
    } else {
      if (rainUrl) stopLoop(rainUrl, { fadeOut: 3.0 });
    }
  });

  world.on('weather:lightning', ({ x, y }) => {
    sfxAt("thunder", { x, y }, pp());
  });

  // Floor transitions — stop rain, adjust reverb for environment
  world.on('dungeon:transitioned', () => {
    if (rainUrl) stopLoop(rainUrl, { fadeOut: 1.0 });

    // Reverb: overworld (depth 0) = dry/open air, dungeon = stone room reverb
    // Deeper floors get slightly more reverb (tighter stone corridors)
    const depth = getDepth();
    if (depth === 0) {
      setReverbMix(0.05);  // outdoors — barely any
    } else {
      setReverbMix(Math.min(0.45, 0.15 + depth * 0.05));  // 0.20 at d1, 0.45 cap
    }
  });

  // ── UI ────────────────────────────────────────────────────

  world.on('spell:learned', () => {
    sfx("level:up"); // UI sounds are always center, full vol
  });
}
