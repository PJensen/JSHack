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
 * Install audio event listeners on the ECS world.
 * Call once during display setup.
 *
 * @param {{ world: object, isPlayer: (id: number) => boolean }} deps
 */
export function installAudioWiring({ world, isPlayer }) {

  // ── Preload all registered sounds ─────────────────────────
  preload(allUrls());

  // ── Combat ────────────────────────────────────────────────

  world.on('damaged', ({ cause, critical, target }) => {
    if (cause === 'melee' || cause === 'offhand') {
      sfx(critical ? "melee:crit" : "melee:hit");
    }
    // Ranged impacts handled via ranged:shot below
  });

  world.on('hit', (ctx) => {
    // miss — hit event fires but ctx.missed is true in some flows
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

  // ── Items ─────────────────────────────────────────────────

  world.on('item:pickup', () => {
    sfx("item:pickup");
  });

  world.on('item:dropped', () => {
    sfx("item:drop");
  });

  world.on('item:equipped', () => {
    sfx("item:equip");
  });

  world.on('chest:open', () => {
    sfx("chest:open");
  });

  // ── Environment ───────────────────────────────────────────

  world.on('stair:traverse', ({ direction }) => {
    sfx(direction === 'up' ? "stair:ascend" : "stair:descend");
  });

  // ── Spells ────────────────────────────────────────────────
  // Each spell gets its own sound file.

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
