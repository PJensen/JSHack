// Wires ECS world events to audio playback.
// Listens to game events and plays the matching sound from the registry.
//
// Spatial audio: sounds with a known {x,y} source are panned L/R and
// attenuated by distance from the player. Sounds through walls are muffled.

import { play, preload, startLoop, stopLoop, startLoopSequence, stopLoopSequence, setReverbMix } from "./audioEngine.js";
import { resolve, resolveUrls, allUrls } from "./sounds.js";
import {
  planMeleeDeath,
  planShieldBlock,
  planWeaponDeflect,
  planWeaponImpact,
  planWeaponReady,
  planWeaponWhoosh,
} from "./combatAudioAdapter.js";

export const ALERT_SOUND_BY_IDENTITY = Object.freeze({
  snake: "snake:alert",
  cave_snake: "snake:alert",
  pit_viper: "snake:alert",
  spider: "spider:alert",
  cave_spider: "spider:alert",
  phase_spider: "spider:alert",
  grid_bug: "insect:alert",
  centipede: "insect:alert",
  gelatinous_cube: "gelatinous_cube:alert",
  cave_bear: "creature:alert:large_beast",
  boar: "creature:alert:large_beast",
  dragon: "creature:alert:large_beast",
  dragon_whelp: "creature:alert:large_beast",
  rat: "rat:alert",
});

export const CREATURE_ATTACK_SOUNDS = Object.freeze({
  cave_bear: "cave_bear:attack",
  rat: "rat:attack",
  grid_bug: "insect:attack",
  centipede: "insect:attack",
  spider: "spider:attack",
  cave_spider: "spider:attack",
  phase_spider: "spider:attack",
});

export const CREATURE_VOCALIZE_SOUNDS = Object.freeze({
  chick: "ambient:chick",
  chicken_hen: "ambient:chicken",
  chicken_rooster: "ambient:chicken",
});

export const DEATH_SOUND_BY_IDENTITY = Object.freeze({
  boar: "creature:boar:died",
  skeleton: "creature:skeleton:died",
  skeleton_archer: "creature:skeleton:died",
  skeleton_sharpshooter: "creature:skeleton:died",
});

export const STATUS_SOUND_BY_KIND = Object.freeze({
  deafened: "status:deafened",
  deaf: "status:deafened",
  slimed: "status:slimed",
  slime: "status:slimed",
  frozen: "status:frozen",
  frost: "status:frozen",
  electrocuted: "status:electrocuted",
  electric: "status:electrocuted",
  lightning: "status:electrocuted",
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
const PLAYER_NEAR_DEATH_RATIO = 0.25;
const DUNGEON_OMEN_EVENT_GAP = 18;
const DUNGEON_OMEN_CHANCE = 12;
const DEAFENED_SOUND_COOLDOWN_MS = 2500;

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

export function resolveStatusSoundId(payload) {
  const raw = payload?.sound || payload?.kind || payload?.effect || payload?.status || payload?.type || "";
  const key = String(raw || "").toLowerCase();
  return STATUS_SOUND_BY_KIND[key] || null;
}

export function resolveAudioPlayKey(payload) {
  return String(payload?.key || payload?.id || payload?.sound || "");
}

function isSpellLikeDamageCause(cause) {
  const value = String(cause || "");
  return value === "spell" || value === "magic" || value.startsWith("spell:") || value.startsWith("familiar:");
}

export function shouldPlayElectrocutionSound(payload) {
  const type = String(payload?.type || "").toLowerCase();
  return type === "electric" || type === "lightning";
}

export function shouldPlayTeleportSound(payload, isPlayerFn) {
  const id = Number(payload?.id || 0) | 0;
  if (!(id > 0) || typeof isPlayerFn !== "function" || !isPlayerFn(id)) return false;
  const src = String(payload?.source || "");
  return src !== "dungeon:teleport-depth";
}

function audioNowMs() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function hashOmenPayload(payload, depth, eventIndex) {
  const at = payload?.at || {};
  const text = [
    payload?.kind,
    payload?.medium,
    payload?.cause,
    payload?.sourceKind,
    payload?.identity,
    depth,
    Number(at.x) | 0,
    Number(at.y) | 0,
    eventIndex,
  ].join(":");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function shouldPlayDungeonOmen(payload, state, depth) {
  if (!payload || typeof payload !== "object") return false;
  const currentDepth = Number(depth || 0) | 0;
  if (currentDepth <= 0) return false;

  const at = payload.at || null;
  const x = Number(at?.x);
  const y = Number(at?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;

  const kind = String(payload.kind || payload.identity || payload.sourceKind || "").toLowerCase();
  const cause = String(payload.cause || payload.sourceKind || "").toLowerCase();
  if (!kind && !cause) return false;

  state.eventIndex = (Number(state.eventIndex || 0) | 0) + 1;
  const last = Number(state.lastPlayedEventIndex || -Infinity);
  if (state.eventIndex - last < DUNGEON_OMEN_EVENT_GAP) return false;

  const hash = hashOmenPayload(payload, currentDepth, state.eventIndex);
  if ((hash % DUNGEON_OMEN_CHANCE) !== 0) return false;

  state.lastPlayedEventIndex = state.eventIndex;
  return true;
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
    stopAfter: s.stopAfter, fadeOut: s.fadeOut,
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

function sfxAtDelay(id, sourcePos, playerPos, extraOpts, zoomGain, delayMs) {
  const delay = Math.max(0, Number(delayMs || 0) | 0);
  if (delay <= 0 || typeof globalThis.setTimeout !== "function") {
    sfxAt(id, sourcePos, playerPos, extraOpts, zoomGain);
    return;
  }
  globalThis.setTimeout(() => sfxAt(id, sourcePos, playerPos, extraOpts, zoomGain), delay);
}

/**
 * Resolve an item entity's type to a sound category.
 */
function itemCategory(getItemInfo, itemId) {
  const info = getItemInfo(itemId);
  if (!info) return "generic";
  const t = info.type;
  const slot = String(info.slot || "").toLowerCase();
  const name = String(info.name || info.id || "").toLowerCase();
  if (t === "weapon") return "weapon";
  if (slot === "weapon" || info.damageDice) return "weapon";
  if (t === "armor" || t === "shield" || t === "helmet" || t === "boots" || t === "gloves" || slot === "offhand" && name.includes("shield")) return "armor";
  if (t === "potion") return "potion";
  if (t === "scroll") return "scroll";
  if (t === "gold" || t === "coin") return "gold";
  if (t === "food" || t === "corpse") return "food";
  if (t === "gem") return "gem";
  return "generic";
}

function combatInfoFor(getItemInfo, itemId) {
  const info = getItemInfo(itemId);
  if (!info) return null;
  return { ...info, id: info.id || info.identity || "" };
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
  'spell:heal',
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

export const CHANNELING_LOOP_SOUND_ID = "spell:channeling";
export const CHANNELING_LOOP_OPTIONS = Object.freeze({
  volume: 0.42,
  fadeIn: 0.12,
  fadeOut: 0.18,
  bus: "spells",
  crossfade: 0.18,
});

export const DUNGEON_LOOP_SOUND_ID = "ambient:dungeon";
export const DUNGEON_LOOP_OPTIONS = Object.freeze({
  volume: 0.22,
  fadeIn: 1.5,
  fadeOut: 1.0,
  bus: "ambient:loop",
  crossfade: 2.0,
});

export const FAMILIAR_FIRE_READY_SOUND_ID = "torch:ignite";
export const FAMILIAR_FIRE_CAST_SOUND_ID = "spell:fireball";
export const FOOD_EAT_SOUND_ID = "item:consume:food";
export const PUSH_STONE_SOUND_ID = "action:move_boulder";
export const TRAP_SOUND_BY_TYPE = Object.freeze({
  snake: "trap:snake",
  spike: "trap:spike",
});
export const WEAPON_RACK_DROPPED_SOUND_ID = "rack:weapon:dropped";

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

  const warmupIds = [
    "item:equip:weapon",
    "item:equip:armor",
    "melee:miss",
    "melee:hit",
    "shield:blocked",
  ];
  preload([...new Set(warmupIds.flatMap(resolveUrls))]).catch?.(() => {});

  const channelingLoopUrl = resolve(CHANNELING_LOOP_SOUND_ID)?.url;
  let channelingLoopActive = false;
  const dungeonOmenState = { eventIndex: 0, lastPlayedEventIndex: -Infinity };
  const dungeonOmenEntityIds = new Set();
  const deafenedSoundAt = new Map();

  function startChannelingLoop(actor) {
    if (!channelingLoopUrl || !isPlayer(actor) || channelingLoopActive) return;
    channelingLoopActive = true;
    startLoop(channelingLoopUrl, {
      volume: CHANNELING_LOOP_OPTIONS.volume,
      fadeIn: CHANNELING_LOOP_OPTIONS.fadeIn,
      bus: CHANNELING_LOOP_OPTIONS.bus,
      crossfade: CHANNELING_LOOP_OPTIONS.crossfade,
    });
  }

  function stopChannelingLoop(actor) {
    if (!channelingLoopUrl || !channelingLoopActive) return;
    if (actor != null && !isPlayer(actor)) return;
    channelingLoopActive = false;
    stopLoop(channelingLoopUrl, { fadeOut: CHANNELING_LOOP_OPTIONS.fadeOut });
  }

  /** Shorthand — current player pos for spatial calcs. */
  function pp() { return getPlayerPosition(); }
  function zg() {
    if (typeof getZoomScale !== "function") return 1;
    const reference = typeof getReferenceZoomScale === "function" ? getReferenceZoomScale() : getZoomScale();
    return computeZoomAudibilityGain(getZoomScale(), reference);
  }

  function maybePlayDungeonOmen(payload) {
    const eventEntityId = Number(payload?.hazardId || payload?.cloudId || 0) | 0;
    if (eventEntityId > 0) {
      if (dungeonOmenEntityIds.has(eventEntityId)) return;
      dungeonOmenEntityIds.add(eventEntityId);
      if (dungeonOmenEntityIds.size > 128) dungeonOmenEntityIds.clear();
    }
    if (shouldPlayDungeonOmen(payload, dungeonOmenState, getDepth())) {
      sfxAt("ambient:omen", payload.at, pp(), { priority: 0, volume: 0.55 }, zg());
    }
  }

  function playDeafenedForTarget(target, opts = null) {
    const id = Number(target || 0) | 0;
    if (!isPlayer(id)) return;
    const now = audioNowMs();
    const last = deafenedSoundAt.get(id) || -Infinity;
    if (now - last < DEAFENED_SOUND_COOLDOWN_MS) return;
    deafenedSoundAt.set(id, now);
    sfx("status:deafened", { priority: 1, ...(opts || {}) });
  }

  function playWeaponWhoosh({ weaponId, attacker, at, offhand }) {
    const info = combatInfoFor(getItemInfo, weaponId);
    playCombatLayers(planWeaponWhoosh({ itemInfo: info, offhand }), at || (attacker != null ? getPosition(attacker) : null));
  }

  function playWeaponImpact(payload) {
    const info = combatInfoFor(getItemInfo, payload?.weaponId);
    const pos = payload?.at || (payload?.target != null ? getPosition(payload.target) : null);
    playCombatLayers(planWeaponImpact({
      itemInfo: info,
      type: payload?.type,
      amount: payload?.amount,
      critical: payload?.critical,
      targetKind: payload?.targetKind,
      sizeClass: payload?.sizeClass,
    }), pos);
  }

  function playWeaponDeflect({ weaponId, at, entityId, hard = true, volume = 0.9 }) {
    const info = combatInfoFor(getItemInfo, weaponId);
    playCombatLayers(planWeaponDeflect({ itemInfo: info, hard, volume }), at || (entityId != null ? getPosition(entityId) : null));
  }

  function playShieldBlock({ shieldId, id, at, broken }) {
    const info = combatInfoFor(getItemInfo, shieldId);
    playCombatLayers(planShieldBlock({ shieldInfo: info, broken }), at || (id != null ? getPosition(id) : null));
  }

  function playWeaponEquip(itemId, action) {
    const info = combatInfoFor(getItemInfo, itemId);
    const layers = planWeaponReady({ itemInfo: info, action });
    if (layers.length > 0) {
      playCombatLayers(layers, null, { centered: true, bus: "items" });
    } else {
      sfx("item:equip:weapon", { priority: 1 });
    }
  }

  function playCombatLayers(layers, pos, defaults = null) {
    for (const part of layers || []) {
      const opts = {
        priority: part.priority ?? 1,
        volume: part.volume,
        rate: part.rate,
        bus: defaults?.bus,
      };
      if (defaults?.centered) {
        sfxAtDelay(part.id, null, null, opts, 1, part.delayMs || 0);
      } else {
        sfxAtDelay(part.id, pos, pp(), opts, zg(), part.delayMs || 0);
      }
    }
  }

  // ── Combat ────────────────────────────────────────────────

  world.on('combat:melee:attack', ({ attacker, weaponId, at, offhand }) => {
    playWeaponWhoosh({ weaponId, attacker, at, offhand });
  });

  world.on('combat:melee:miss', ({ attacker, weaponId, at, offhand }) => {
    playWeaponWhoosh({ weaponId, attacker, at, offhand });
  });

  world.on('combat:fumble', ({ attacker, weaponId, at }) => {
    playWeaponDeflect({ weaponId, at, entityId: attacker, hard: false, volume: 0.72 });
  });

  world.on('combat:dodge', ({ attacker, weaponId, at, offhand }) => {
    playWeaponWhoosh({ weaponId, attacker, at, offhand });
  });

  world.on('damaged', ({ cause, critical, type, at, target, source, weaponId, amount, targetKind, sizeClass }) => {
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
      playWeaponImpact({ cause, critical, type, at: pos, target, source, weaponId, amount, targetKind, sizeClass });
    }
    // Skip impact sounds for DOT ticks and direct spell casts (no separate impact phase)
    const noImpactKeys = new Set(['agony', 'spell:agony', 'poison', 'bleed', 'burn', 'shock', 'swarm', 'frost', 'spell:smite']);
    if (isSpellLikeDamageCause(cause) && !noImpactKeys.has(cause)) {
      const impactId = SPELL_IMPACT_MAP[type] || "spell:impact:physical";
      sfxAt(impactId, pos, pp(), null, zg());
    }
    // Electrocution sound for any electric/lightning hit, including grid bugs.
    if (shouldPlayElectrocutionSound({ type })) {
      sfxAt("status:electrocuted", pos, pp(), { priority: 1 }, zg());
    }
  });

  world.on('damaged', ({ target, hpBefore, hpAfter, maxHp }) => {
    if (!isPlayer(target)) return;
    const cap = Number(maxHp || 0);
    if (!(cap > 0)) return;
    const beforeRatio = Number(hpBefore || 0) / cap;
    const after = Number(hpAfter || 0);
    const afterRatio = after / cap;
    if (after > 0 && beforeRatio > PLAYER_NEAR_DEATH_RATIO && afterRatio <= PLAYER_NEAR_DEATH_RATIO) {
      sfx("player:near_death", { priority: 1 });
    }
  });

  world.on('hit', (ctx) => {
    if (ctx.missed) {
      const pos = ctx.at || (ctx.target != null ? getPosition(ctx.target) : null);
      playWeaponWhoosh({
        weaponId: ctx.weaponId || 0,
        attacker: ctx.attacker,
        at: pos,
        offhand: !!ctx.offhand,
      });
    }
  });

  world.on('combat:parry', ({ weaponId, attackerWeaponId, at, defender, attacker }) => {
    playWeaponDeflect({ weaponId, at, entityId: defender, hard: true, volume: 0.95 });
    if (attackerWeaponId) {
      sfxAtDelay(
        combatSoundId(resolveCombatFamily(combatInfoFor(getItemInfo, attackerWeaponId)) || "sword_small", "deflect"),
        at || (attacker != null ? getPosition(attacker) : null),
        pp(),
        { priority: 0, volume: 0.42 },
        zg(),
        24,
      );
    }
  });

  world.on('shield:guarded', ({ id, at, shieldId, broken }) => {
    playShieldBlock({ shieldId, id, at, broken });
  });

  world.on('proc:shocked', ({ target, at }) => {
    const pos = at || (target != null ? getPosition(target) : null);
    sfxAt("status:electrocuted", pos, pp(), { priority: 1 }, zg());
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

  world.on('died', ({ id, critical, amount, weaponId, cause, damageType, sizeClass }) => {
    const pos = getPosition(id);
    if (isPlayer(id)) {
      stopChannelingLoop(id);
      const heavyDeath = critical || (Number(amount) >= 15);
      const deathId = heavyDeath ? "player:death:heavy" : "player:death";
      sfx(deathId); // player death is always full volume center
    } else {
      const creatureId = typeof getIdentity === "function" ? String(getIdentity(id) || "") : "";
      const deathSoundId = DEATH_SOUND_BY_IDENTITY[creatureId] || "death";
      sfxAt(deathSoundId, pos, pp(), null, zg());
      if (cause === "melee" || cause === "offhand") {
        const info = combatInfoFor(getItemInfo, weaponId);
        playCombatLayers(planMeleeDeath({
          itemInfo: info,
          damageType,
          amount,
          critical,
          sizeClass,
        }), pos);
      }
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
    if (cat === "weapon" || cat === "armor") {
      playWeaponEquip(itemId, "equip");
      return;
    }
    const equipId = (cat === "weapon" || cat === "armor")
      ? `item:equip:${cat}`
      : "item:equip:generic";
    sfx(equipId); // equip is always the player — center, full vol
  });

  world.on('item:unequipped', ({ itemId }) => {
    const cat = itemCategory(getItemInfo, itemId);
    if (cat === "weapon" || cat === "armor") {
      playWeaponEquip(itemId, "unequip");
      return;
    }
    sfx("item:equip:generic", { priority: 1, volume: 0.75 });
  });

  world.on('hunger:ate', ({ actor }) => {
    if (!isPlayer(actor)) return;
    const pos = actor != null ? getPosition(actor) : null;
    sfxAt(FOOD_EAT_SOUND_ID, pos, pp(), { priority: 1 }, zg());
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

  world.on('rack:looted', ({ targetId }) => {
    const pos = targetId != null ? getPosition(targetId) : null;
    sfxAt(WEAPON_RACK_DROPPED_SOUND_ID, pos, pp(), { priority: 1 }, zg());
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

  world.on('hazard:spawned', (payload) => {
    maybePlayDungeonOmen(payload);
  });

  world.on('plasmaCloud:spawned', (payload) => {
    maybePlayDungeonOmen({ kind: "plasma", medium: "air", ...(payload || {}) });
  });

  world.on('bell:rung', ({ targetId }) => {
    const pos = targetId != null ? getPosition(targetId) : null;
    sfxAt("church:bell", pos, pp(), { priority: 1 }, zg());
  });

  world.on('fountain:drink', ({ targetId, effect }) => {
    const pos = targetId != null ? getPosition(targetId) : null;
    sfxAt("fountain:sip", pos, pp(), null, zg());
    if (effect === "gush") sfxAt("water:magic", pos, pp(), { priority: 1 }, zg());
    if (effect === "teleport") sfx("teleported", { priority: 1 });
  });

  world.on('fountain:dip', ({ targetId, effect }) => {
    const pos = targetId != null ? getPosition(targetId) : null;
    sfxAt("fountain:sip", pos, pp(), null, zg());
  });

  world.on('hydraulics:floodgate', ({ targetId, active, tilesChanged }) => {
    if (!active || !(Number(tilesChanged || 0) > 0)) return;
    const pos = targetId != null ? getPosition(targetId) : null;
    sfxAt("water:magic", pos, pp(), { priority: 1 }, zg());
  });

  world.on('trap:triggered', ({ trapId, type }) => {
    const soundId = TRAP_SOUND_BY_TYPE[String(type || "").toLowerCase()];
    if (!soundId) return;
    const pos = trapId != null ? getPosition(trapId) : null;
    sfxAt(soundId, pos, pp(), { priority: 1 }, zg());
  });

  world.on('entity:pushed', ({ target, to }) => {
    const pos = to || (target != null ? getPosition(target) : null);
    sfxAt(PUSH_STONE_SOUND_ID, pos, pp(), { priority: 1 }, zg());
  });

  world.on('status', (payload) => {
    const { id, kind, at } = payload || {};
    if (kind === 'alert') {
      if (!(id > 0) || typeof getIdentity !== "function") return;
      const identity = String(getIdentity(id) || "");
      const soundId = ALERT_SOUND_BY_IDENTITY[identity];
      if (!soundId) return;
      const pos = at || getPosition(id);
      sfxAt(soundId, pos, pp(), { priority: 1 }, zg());
      return;
    }

    const soundId = resolveStatusSoundId(payload);
    if (!soundId) return;
    if (soundId === "status:deafened") {
      playDeafenedForTarget(id);
      return;
    }
    if (isPlayer(id)) {
      sfx(soundId, { priority: 1 });
      return;
    }
    const pos = at || (id != null ? getPosition(id) : null);
    sfxAt(soundId, pos, pp(), { priority: 1 }, zg());
  });

  world.on('status:deafened', ({ target, severity }) => {
    if (isPlayer(target) && severity >= 1) {
      playDeafenedForTarget(target, { volume: 0.8 });
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

  world.on('teleported', (payload) => {
    const { id, from, to } = payload || {};
    if (!shouldPlayTeleportSound(payload, isPlayer)) return;
    const pos = to || from || (id != null ? getPosition(id) : null);
    sfxAt("teleported", pos, pp(), { priority: 1 }, zg());
  });

  world.on('pet:teleported', ({ petId, id, from, to }) => {
    // Pet catch-up teleports are housekeeping, not a player-facing teleport cast.
  });

  world.on('summon:teleported', ({ id, from, to }) => {
    // Summon catch-up/materialization teleports are intentionally silent.
  });

  // ── Spells (cast / launch sounds) ─────────────────────────
  // Each spell gets its own sound on cast. Impact sounds fire
  // separately via the 'damaged' handler above when the spell
  // actually hits after travel time.

  world.on('channeling:start', ({ actor }) => {
    startChannelingLoop(actor);
  });

  world.on('channeling:complete', ({ actor }) => {
    stopChannelingLoop(actor);
  });

  world.on('channeling:cancelled', ({ actor }) => {
    stopChannelingLoop(actor);
  });

  for (const ev of SPELL_CAST_SOUND_EVENTS) {
    world.on(ev, (payload) => {
      // Spells carry origin info in various fields
      const pos = payload?.at || payload?.origin || payload?.from || null;
      sfxAt(ev, pos, pp(), null, zg());
    });
  }

  world.on('spell:blink', (payload) => {
    sfxAt("teleported", payload?.to || payload?.at || payload?.from || null, pp(), { priority: 1 }, zg());
  });

  world.on('spell:phase_strike', (payload) => {
    sfxAt("teleported", payload?.to || payload?.at || payload?.from || null, pp(), { priority: 1 }, zg());
  });

  world.on('familiar:ready', ({ id }) => {
    const pos = id != null ? getPosition(id) : null;
    sfxAt(FAMILIAR_FIRE_READY_SOUND_ID, pos, pp(), { priority: 1, volume: 0.65 }, zg());
  });

  world.on('familiar:fireball', (payload) => {
    sfxAt(FAMILIAR_FIRE_CAST_SOUND_ID, payload?.from || payload?.at || null, pp(), { priority: 1 }, zg());
  });

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
  const dungeonLoopUrls = resolveUrls(DUNGEON_LOOP_SOUND_ID);
  let dungeonActive = false;

  world.on('dungeon:transitioned', () => {
    stopChannelingLoop(null);

    if (rainUrl) stopLoop(rainUrl, { fadeOut: 1.0 });

    // Reverb: overworld (depth 0) = dry/open air, dungeon = stone room reverb
    // Deeper floors get slightly more reverb (tighter stone corridors)
    const depth = getDepth();
    if (depth === 0) {
      setReverbMix(0.05);  // outdoors — barely any
      if (dungeonActive) {
        stopLoopSequence(DUNGEON_LOOP_SOUND_ID, { fadeOut: DUNGEON_LOOP_OPTIONS.fadeOut });
        dungeonActive = false;
      }
    } else {
      setReverbMix(Math.min(0.45, 0.15 + depth * 0.05));  // 0.20 at d1, 0.45 cap
      if (dungeonLoopUrls.length > 0 && !dungeonActive) {
        startLoopSequence(DUNGEON_LOOP_SOUND_ID, dungeonLoopUrls, {
          volume: DUNGEON_LOOP_OPTIONS.volume,
          fadeIn: DUNGEON_LOOP_OPTIONS.fadeIn,
          bus: DUNGEON_LOOP_OPTIONS.bus,
          crossfade: DUNGEON_LOOP_OPTIONS.crossfade,
        });
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
  world.on('audio:play', (payload) => {
    const key = resolveAudioPlayKey(payload);
    const x = Number(payload?.x ?? payload?.at?.x);
    const y = Number(payload?.y ?? payload?.at?.y);
    if (!key) return;
    if (Number.isFinite(x) && Number.isFinite(y)) {
      sfxAt(key, { x, y }, pp(), null, zg());
    } else {
      sfx(key);
    }
  });
}
