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
  cave_bear: "creature:alert:large_beast",
  boar: "creature:alert:large_beast",
  dragon: "creature:alert:large_beast",
  dragon_whelp: "creature:alert:large_beast",
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

// Pet vocalization sound map
const PET_VOCALIZE_SOUNDS = Object.freeze({
  cat: "creature:pet:meow",
  dog: "creature:pet:meow",
  familiar: "creature:pet:meow",
});

// Cooldown tracking for pet vocalizations (Map<id, turnsLeft>)
const _petVocalizationCooldowns = new Map();

// ── Spatial helpers ─────────────────────────────────────────

/** Max tile distance at which a sound is still audible. Beyond this → silent. */
const MAX_HEAR_DIST = 16;
const MIN_ZOOM_GAIN = 0.65;
const MAX_ZOOM_GAIN = 1.35;

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

export function computeZoomAudibilityGain(zoomScale, referenceScale) {
  const zoom = Number(zoomScale);
  const reference = Number(referenceScale);
  if (!Number.isFinite(zoom) || !Number.isFinite(reference) || zoom <= 0 || reference <= 0) return 1;
  const gain = Math.sqrt(zoom / reference);
  return Math.max(MIN_ZOOM_GAIN, Math.min(MAX_ZOOM_GAIN, gain));
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
function sfxAt(id, sourcePos, playerPos, extraOpts, zoomGain = 1) {
  const spatial = spatialize(sourcePos, playerPos);
  if (spatial.volume <= 0) return; // too far, don't play
  const sound = resolve(id);
  const baseVolume = Number.isFinite(Number(sound?.volume)) ? Number(sound.volume) : 1;
  const { volume: volumeOverride, ...restOpts } = extraOpts || {};
  const gain = Number.isFinite(Number(volumeOverride)) ? Number(volumeOverride) : baseVolume;
  // Sounds at/adjacent to player (volume >= 0.95) keep priority 1.
  // Everything else is priority 0 and evictable when player acts.
  const priority = spatial.volume >= 0.95 ? 1 : 0;
  sfx(id, { pan: spatial.pan, volume: spatial.volume * gain * zoomGain, priority, ...restOpts });
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
  'spell:agony',
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
 *   getZoomScale?: () => number,
 *   getReferenceZoomScale?: () => number,
 * }} deps
 */
export function installAudioWiring({ world, isPlayer, getItemInfo, getPlayerPosition, getPosition, getIdentity, getDepth, getZoomScale, getReferenceZoomScale }) {

  // No preload — sounds are fetched on first play. Missing files fail once
  // and are blacklisted so they never retry or flood the network.

  /** Shorthand — current player pos for spatial calcs. */
  function pp() { return getPlayerPosition(); }
  function zg() {
    if (typeof getZoomScale !== "function") return 1;
    const reference = typeof getReferenceZoomScale === "function" ? getReferenceZoomScale() : getZoomScale();
    return computeZoomAudibilityGain(getZoomScale(), reference);
  }

  // ── Combat ────────────────────────────────────────────────

  world.on('damaged', ({ cause, critical, type, at, target, source }) => {
    const pos = at || (target != null ? getPosition(target) : null);
    // Creature attack vocalizations (roars, squeaks, etc.)
    if ((cause === 'melee' || cause === 'offhand') && source > 0 && typeof getIdentity === "function") {
      const srcIdentity = String(getIdentity(source) || "");
      const creatureAttackId = CREATURE_ATTACK_SOUNDS[srcIdentity];
      if (creatureAttackId) {
        const srcPos = source != null ? getPosition(source) : null;
        sfxAt(creatureAttackId, srcPos, pp(), { priority: 1 }, zg());
      }
    }
    // Impact sounds on hit
    if (cause === 'melee' || cause === 'offhand') {
      sfxAt(critical ? "melee:crit" : "melee:hit", pos, pp(), null, zg());
    }
    if (cause === 'spell' || cause === 'magic') {
      const impactId = SPELL_IMPACT_MAP[type] || "spell:impact:physical";
      sfxAt(impactId, pos, pp(), null, zg());
    }
    // Electrocution sound for electric/lightning damage
    if ((type === 'electric' || type === 'lightning') && cause === 'spell') {
      sfxAt("status:electrocuted", pos, pp(), { priority: 1 }, zg());
    }
  });

  world.on('hit', (ctx) => {
    if (ctx.missed) {
      const pos = ctx.at || (ctx.target != null ? getPosition(ctx.target) : null);
      sfxAt("melee:miss", pos, pp(), null, zg());
    }
  });

  world.on('shield:guarded', ({ id, at }) => {
    const pos = at || (id != null ? getPosition(id) : null);
    sfxAt("shield:blocked", pos, pp(), { priority: 1 }, zg());
  });

  world.on('creature:vocalize', ({ identity, at }) => {
    const soundId = CREATURE_VOCALIZE_SOUNDS[identity];
    if (soundId) {
      sfxAt(soundId, at, pp(), null, zg());
    }
  });

  // Pet vocalization with cooldown gating (called from petBehaviorSystem)
  world.on('pet:vocalize', ({ id, identity, at }) => {
    const petId = Number(id || 0) | 0;
    const cooldown = _petVocalizationCooldowns.get(petId) ?? 0;
    if (cooldown > 0) {
      _petVocalizationCooldowns.set(petId, cooldown - 1);
      return; // Skip this vocalization
    }

    const soundId = PET_VOCALIZE_SOUNDS[identity] || "creature:pet:meow";
    sfxAt(soundId, at, pp(), null, zg());
    _petVocalizationCooldowns.set(petId, 60); // 60-turn cooldown between vocalizations
  });

  world.on('ranged:shot', ({ attacker, target }) => {
    const pos = attacker != null ? getPosition(attacker) : null;
    sfxAt("ranged:shot", pos, pp(), null, zg());
  });

  world.on('died', ({ id, critical, amount }) => {
    const pos = getPosition(id);
    if (isPlayer(id)) {
      const heavyDeath = critical || (Number(amount) >= 15);
      const deathId = heavyDeath ? "player:death:heavy" : "player:death";
      sfx(deathId); // player death is always full volume center
    } else {
      const creatureId = typeof getIdentity === "function" ? String(getIdentity(id) || "") : "";
      const deathSoundId = creatureId === "boar" ? "creature:boar:died" : "death";
      sfxAt(deathSoundId, pos, pp(), null, zg());
    }
  });

  // ── Items (sound varies by item type) ─────────────────────

  world.on('item:pickup', ({ itemId, itemX, itemY }) => {
    const cat = itemCategory(getItemInfo, itemId);
    const pos = (itemX != null && itemY != null) ? { x: itemX, y: itemY } : null;
    sfxAt(`item:pickup:${cat}`, pos, pp(), null, zg());
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
    sfxAt(dropId, at, pp(), null, zg());
  });

  world.on('interaction', ({ action, result, targetId }) => {
    if (action === 'toggleDoor') {
      const doorSoundId = result === 'opened' ? 'door:open' : 'door:close';
      const pos = targetId != null ? getPosition(targetId) : null;
      sfxAt(doorSoundId, pos, pp(), { priority: 1, volume: 1.25 }, zg());
    }
  });

  world.on('potion:splash', ({ at }) => {
    sfxAt("item:impact:potion", at, pp(), null, zg());
  });

  world.on('potion:splash:dud', ({ at }) => {
    sfxAt("item:impact:potion", at, pp(), null, zg());
  });

  world.on('potion:oil_splash', ({ at }) => {
    sfxAt("item:impact:potion", at, pp(), null, zg());
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
    sfxAt("chest:open", pos, pp(), null, zg());
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
    sfxAt(dropId, pos, pp(), null, zg());
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

  world.on('hazard:spawned', ({ at }) => {
    sfx("ambient:omen", { priority: 1 });
  });

  world.on('plasmaCloud:spawned', ({ at }) => {
    sfx("ambient:omen", { priority: 1 });
  });

  world.on('bell:rung', ({ targetId }) => {
    const pos = targetId != null ? getPosition(targetId) : null;
    sfxAt("church:bell", pos, pp(), { priority: 1 }, zg());
  });

  world.on('fountain:drink', ({ targetId, effect }) => {
    const pos = targetId != null ? getPosition(targetId) : null;
    sfxAt("fountain:sip", pos, pp(), null, zg());
  });

  world.on('fountain:dip', ({ targetId, effect }) => {
    const pos = targetId != null ? getPosition(targetId) : null;
    sfxAt("fountain:sip", pos, pp(), null, zg());
  });

  world.on('status', ({ id, kind, at }) => {
    if (kind !== 'alert' || !(id > 0) || typeof getIdentity !== "function") return;
    const identity = String(getIdentity(id) || "");
    const soundId = ALERT_SOUND_BY_IDENTITY[identity];
    if (!soundId) return;
    const pos = at || getPosition(id);
    sfxAt(soundId, pos, pp(), { priority: 1 }, zg());
  });

  world.on('status:deafened', ({ target, severity }) => {
    if (isPlayer(target) && severity >= 1) {
      sfx("status:deafened", { volume: 0.8 });
    }
  });

  world.on('status:slimed', ({ target, severity }) => {
    if (isPlayer(target) && severity > 0) {
      sfx("status:slimed", { volume: 0.7 });
    }
  });

  world.on('status:frozen', ({ target, at }) => {
    const pos = at || (target != null ? getPosition(target) : null);
    sfxAt("status:frozen", pos, pp(), null, zg());
  });

  // ── Spells (cast / launch sounds) ─────────────────────────
  // Each spell gets its own sound on cast. Impact sounds fire
  // separately via the 'damaged' handler above when the spell
  // actually hits after travel time.

  for (const ev of SPELL_CAST_SOUND_EVENTS) {
    world.on(ev, (payload) => {
      // Spells carry origin info in various fields
      const pos = payload?.at || payload?.origin || payload?.from || null;
      sfxAt(ev, pos, pp(), null, zg());
    });
  }

  // Meteor should land one impact sound at the resolved strike point,
  // not a cast sound and not one sound per damaged target.
  world.on('spell:meteor', (payload) => {
    const pos = payload?.origin || payload?.at || null;
    sfxAt("spell:impact:meteor", pos, pp(), { priority: 1 }, zg());
  });

  // ── Weather ───────────────────────────────────────────────

  const rainUrl = resolve("rain:loop")?.url;

  world.on('weather:changed', ({ weather }) => {
    if ((weather === 'rain' || weather === 'heavy_rain') && rainUrl) {
      const vol = weather === 'heavy_rain' ? 0.34 : 0.2;
      startLoop(rainUrl, { volume: vol, fadeIn: 2.0, bus: "ambient:loop" });
    } else {
      if (rainUrl) stopLoop(rainUrl, { fadeOut: 3.0 });
    }
  });

  world.on('weather:lightning', ({ x, y }) => {
    const playerPos = pp();
    const spatial = spatialize({ x, y }, playerPos);
    const thunderId = spatial.volume <= 0.45 ? "thunder:distant" : "thunder";
    sfxAt(thunderId, { x, y }, playerPos, null, zg());
  });

  // Floor transitions — stop rain, adjust reverb for environment
  const dungeonUrl = resolve("ambient:dungeon")?.url;
  let dungeonActive = false;

  world.on('dungeon:transitioned', () => {
    if (rainUrl) stopLoop(rainUrl, { fadeOut: 1.0 });

    // Reverb: overworld (depth 0) = dry/open air, dungeon = stone room reverb
    // Deeper floors get slightly more reverb (tighter stone corridors)
    const depth = getDepth();
    if (depth === 0) {
      setReverbMix(0.05);  // outdoors — barely any
      if (dungeonUrl && dungeonActive) {
        stopLoop(dungeonUrl, { fadeOut: 1.0 });
        dungeonActive = false;
      }
    } else {
      setReverbMix(Math.min(0.45, 0.15 + depth * 0.05));  // 0.20 at d1, 0.45 cap
      if (dungeonUrl && !dungeonActive) {
        startLoop(dungeonUrl, { volume: 0.22, fadeIn: 1.5, bus: "ambient:loop" });
        dungeonActive = true;
      }
    }
  });

  // ── UI ────────────────────────────────────────────────────

  world.on('spell:learned', () => {
    sfx("level:up"); // UI sounds are always center, full vol
  });

  world.on('quest:completed', () => {
    sfx("quest:completed"); // One-shot celebration sound
  });

  world.on('hazard:ignited', ({ at }) => {
    const pos = at || null;
    sfxAt("torch:ignite", pos, pp(), null, zg());
  });

  world.on('shop:open', ({ targetId, actor }) => {
    sfx("shop:enter"); // One-time entry chime
  });

  // Generic audio event — play any registered sound by key
  world.on('audio:play', ({ key, x, y }) => {
    if (typeof x === 'number' && typeof y === 'number') {
      sfxAt(key, { x, y }, pp(), null, zg());
    } else {
      sfx(key);
    }
  });
}
