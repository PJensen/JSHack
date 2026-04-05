// Wires ECS world events to audio playback.
// Listens to game events and plays the matching sound from the registry.

import { play, preload } from "./audioEngine.js";
import { resolve, allUrls } from "./sounds.js";

/** Helper — play a registered sound ID with optional overrides. */
function sfx(id, opts) {
  const s = resolve(id);
  if (!s) return;
  play(s.url, { volume: s.volume, rate: s.rate, detune: s.detune, ...opts });
}

/**
 * Resolve an item entity's type to a sound category.
 * Falls back to "generic" for unknown types.
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
 * }} deps
 */
export function installAudioWiring({ world, isPlayer, getItemInfo }) {

  // ── Preload all registered sounds ─────────────────────────
  preload(allUrls());

  // ── Combat ────────────────────────────────────────────────

  world.on('damaged', ({ cause, critical, type }) => {
    if (cause === 'melee' || cause === 'offhand') {
      sfx(critical ? "melee:crit" : "melee:hit");
    }
    // Spell damage impacts — play an impact sound based on damage type
    if (cause === 'spell' || cause === 'magic') {
      const impactId = SPELL_IMPACT_MAP[type] || "spell:impact:physical";
      sfx(impactId);
    }
  });

  world.on('hit', (ctx) => {
    if (ctx.missed) sfx("melee:miss");
  });

  world.on('ranged:shot', () => {
    sfx("ranged:shot");
  });

  world.on('died', ({ id }) => {
    if (isPlayer(id)) {
      sfx("player:death");
    } else {
      sfx("death");
    }
  });

  // ── Items (sound varies by item type) ─────────────────────

  world.on('item:pickup', ({ itemId }) => {
    const cat = itemCategory(getItemInfo, itemId);
    sfx(`item:pickup:${cat}`);
  });

  world.on('item:dropped', ({ itemId }) => {
    const cat = itemCategory(getItemInfo, itemId);
    // Only weapon/armor/potion have distinct drop sounds; rest use generic
    const dropId = (cat === "weapon" || cat === "armor" || cat === "potion")
      ? `item:drop:${cat}`
      : "item:drop:generic";
    sfx(dropId);
  });

  world.on('item:equipped', ({ itemId }) => {
    const cat = itemCategory(getItemInfo, itemId);
    const equipId = (cat === "weapon" || cat === "armor")
      ? `item:equip:${cat}`
      : "item:equip:generic";
    sfx(equipId);
  });

  world.on('chest:open', () => {
    sfx("chest:open");
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
    world.on(ev, () => { sfx(ev); });
  }

  // ── Weather ───────────────────────────────────────────────

  world.on('weather:lightning', () => {
    sfx("thunder");
  });

  // ── UI ────────────────────────────────────────────────────

  world.on('spell:learned', () => {
    sfx("level:up");
  });
}
