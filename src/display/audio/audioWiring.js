// Wires ECS world events to audio playback.
// Listens to game events and plays the matching sound from the registry.
//
// Spatial audio: sounds with a known {x,y} source are panned L/R and
// attenuated by distance from the player. Sounds through walls are muffled.

import { play, preload, startLoop, stopLoop, setReverbMix } from "./audioEngine.js";
import { resolve, allUrls } from "./sounds.js";

export const ALERT_SOUND_BY_IDENTITY = Object.freeze({
  snake: "snake:alert",
  cave_snake: "snake:alert",
  pit_viper: "snake:alert",
  spider: "spider:alert",
  cave_spider: "spider:alert",
  phase_spider: "spider:alert",
  cave_bear: "cave_bear:alert",
  rat: "rat:alert",
});

export const CREATURE_ATTACK_SOUNDS = Object.freeze({
  cave_bear: "cave_bear:attack",
  rat: "rat:attack",
});

export const CREATURE_VOCALIZE_SOUNDS = Object.freeze({
  chick: "ambient:chick",
  chicken_hen: "ambient:chicken",
  chicken_rooster: "ambient:chicken",
});

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
// priority defaults to 1 — direct sfx() calls are always player-triggered.
// sfxAt() overrides this via extraOpts based on distance.
function sfx(id, opts) {
  const s = resolve(id);
  if (!s) return;
  play(s.url, {
    bus: s.bus, maxVoices: s.maxVoices, randomPitch: s.randomPitch,
    volume: s.volume, rate: s.rate, detune: s.detune,
    priority: 1,
    ...opts,
  });
}

/** Play a registered sound positioned in world space. */
function sfxAt(id, sourcePos, playerPos, extraOpts) {
  const spatial = spatialize(sourcePos, playerPos);
  if (spatial.volume <= 0) return; // too far, don't play
  // Sounds at/adjacent to player (volume >= 0.95) keep priority 1.
  // Everything else is priority 0 and evictable when player acts.
  const priority = spatial.volume >= 0.95 ? 1 : 0;
  sfx(id, { pan: spatial.pan, volume: spatial.volume, priority, ...extraOpts });
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

export const SPELL_CAST_SOUND_EVENTS = Object.freeze([
  'spell:bolt',
  'spell:frost',
  'spell:shadow_bolt',
  'spell:fireball',
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
  'spell:spider_lunge',
  'spell:entangle',
]);

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
 *   getIdentity?: (id: number) => string | null,
 *   getDepth: () => number,
 * }} deps
 */
export function installAudioWiring({ world, isPlayer, getItemInfo, getPlayerPosition, getPosition, getIdentity, getDepth }) {

  // No preload — sounds are fetched on first play. Missing files fail once
  // and are blacklisted so they never retry or flood the network.

  /** Shorthand — current player pos for spatial calcs. */
  function pp() { return getPlayerPosition(); }

  // ── Combat ────────────────────────────────────────────────

  world.on('damaged', ({ cause, critical, type, at, target, source }) => {
    const pos = at || (target != null ? getPosition(target) : null);
    // Creature attack vocalizations (roars, squeaks, etc.)
    if ((cause === 'melee' || cause === 'offhand') && source > 0 && typeof getIdentity === "function") {
      const srcIdentity = String(getIdentity(source) || "");
      const creatureAttackId = CREATURE_ATTACK_SOUNDS[srcIdentity];
      if (creatureAttackId) {
        const srcPos = source != null ? getPosition(source) : null;
        sfxAt(creatureAttackId, srcPos, pp(), { priority: 1 });
      }
    }
    // Impact sounds on hit
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

  world.on('shield:guarded', ({ id, at }) => {
    const pos = at || (id != null ? getPosition(id) : null);
    sfxAt("shield:blocked", pos, pp(), { priority: 1 });
  });

  world.on('creature:vocalize', ({ identity, at }) => {
    const soundId = CREATURE_VOCALIZE_SOUNDS[identity];
    if (soundId) {
      sfxAt(soundId, at, pp());
    }
  });

  world.on('ranged:shot', ({ attacker, target }) => {
    const pos = attacker != null ? getPosition(attacker) : null;
    sfxAt("ranged:shot", pos, pp());
  });

  world.on('died', ({ id, critical, amount }) => {
    const pos = getPosition(id);
    if (isPlayer(id)) {
      const heavyDeath = critical || (Number(amount) >= 15);
      const deathId = heavyDeath ? "player:death:heavy" : "player:death";
      sfx(deathId); // player death is always full volume center
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
    let dropId;
    if (cat === "weapon") {
      const material = String(getItemInfo(itemId)?.material || "").toLowerCase();
      if (material === "bone") {
        dropId = "item:drop:bone";
      } else {
        const metallic = material === "iron" || material === "steel" || material === "silver" || material === "gold" || material === "copper" || material === "bronze";
        dropId = metallic ? "item:drop:weapon:metal" : "item:drop:weapon";
      }
    } else if (cat === "armor" || cat === "potion") {
      dropId = `item:drop:${cat}`;
    } else if (cat === "gem") {
      const info = getItemInfo(itemId);
      const mat = info?.material;
      dropId = mat && mat !== "gemstone" ? `item:drop:gem:${mat}` : "item:drop:gem";
      if (!resolve(dropId)) dropId = "item:drop:gem";
    } else {
      dropId = "item:drop:generic";
    }
    sfxAt(dropId, at, pp());
  });

  world.on('interaction', ({ action, result, targetId }) => {
    if (action === 'toggleDoor') {
      const doorSoundId = result === 'opened' ? 'door:open' : 'door:close';
      const pos = targetId != null ? getPosition(targetId) : null;
      sfxAt(doorSoundId, pos, pp(), { priority: 0, volume: 0.6 });
    }
  });

  world.on('potion:splash', ({ at }) => {
    sfxAt("item:impact:potion", at, pp());
  });

  world.on('potion:splash:dud', ({ at }) => {
    sfxAt("item:impact:potion", at, pp());
  });

  world.on('potion:oil_splash', ({ at }) => {
    sfxAt("item:impact:potion", at, pp());
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

  world.on('harvest:picked', ({ itemId, targetId }) => {
    if (!itemId) return;
    const cat = itemCategory(getItemInfo, itemId);
    if (cat !== "gem") return;
    const info = getItemInfo(itemId);
    const mat = info?.material;
    const pos = targetId != null ? getPosition(targetId) : null;
    let dropId = mat && mat !== "gemstone" ? `item:drop:gem:${mat}` : "item:drop:gem";
    if (!resolve(dropId)) dropId = "item:drop:gem";
    sfxAt(dropId, pos, pp());
  });

  // ── Environment ───────────────────────────────────────────

  world.on('stair:traverse', ({ direction }) => {
    sfx(direction === 'up' ? "stair:ascend" : "stair:descend");
  });

  world.on('shrine:communion', () => {
    sfx("deity:omen");
  });

  world.on('deity:omen', () => {
    sfx("deity:omen");
  });

  world.on('bell:rung', ({ targetId }) => {
    const pos = targetId != null ? getPosition(targetId) : null;
    sfxAt("church:bell", pos, pp(), { priority: 1 });
  });

  world.on('status', ({ id, kind, at }) => {
    if (kind !== 'alert' || !(id > 0) || typeof getIdentity !== "function") return;
    const identity = String(getIdentity(id) || "");
    const soundId = ALERT_SOUND_BY_IDENTITY[identity];
    if (!soundId) return;
    const pos = at || getPosition(id);
    sfxAt(soundId, pos, pp(), { priority: 1 });
  });

  // ── Spells (cast / launch sounds) ─────────────────────────
  // Each spell gets its own sound on cast. Impact sounds fire
  // separately via the 'damaged' handler above when the spell
  // actually hits after travel time.

  for (const ev of SPELL_CAST_SOUND_EVENTS) {
    world.on(ev, (payload) => {
      // Spells carry origin info in various fields
      const pos = payload?.at || payload?.origin || payload?.from || null;
      sfxAt(ev, pos, pp());
    });
  }

  // Meteor should land one impact sound at the resolved strike point,
  // not a cast sound and not one sound per damaged target.
  world.on('spell:meteor', (payload) => {
    const pos = payload?.origin || payload?.at || null;
    sfxAt("spell:impact:meteor", pos, pp(), { priority: 1 });
  });

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
    const playerPos = pp();
    const spatial = spatialize({ x, y }, playerPos);
    const thunderId = spatial.volume <= 0.45 ? "thunder:distant" : "thunder";
    sfxAt(thunderId, { x, y }, playerPos);
  });

  world.on('weather:lightning', ({ hitPlayer }) => {
    if (hitPlayer) sfx("ears:ringing", { volume: 0.8 });
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
