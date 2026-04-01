// display/lighting/sources/index.js
// Collect display-side light sources from a WorldView snapshot.
// Returns LightDef[] compatible with the lighting engine.

/** @typedef {import('../engine.js').LightDef} LightDef */

import { basePalette } from '../../palette/base.js';
import { evaluatePattern } from './temporalPatterns.js';

// Mirror of rules/data/calendar.TURNS_PER_DAY — display layer cannot import
// rules directly.  The bridge (worldView) normalises time into turnInDay so
// this constant is only needed for the sun/moon arc boundaries below.
const TURNS_PER_DAY = 720;

// ---- Palette glow lookup ------------------------------------------------

/** Convert "#rrggbb" or "#rgb" hex to [R, G, B] (0-255). */
function hexToRGB(hex) {
  if (!hex) return null;
  const h = hex.replace('#', '');
  if (h.length === 3) return [parseInt(h[0]+h[0],16), parseInt(h[1]+h[1],16), parseInt(h[2]+h[2],16)];
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

/** Cache palette glow colours as RGB arrays. */
const _glowCache = new Map();
function paletteGlow(kind) {
  if (_glowCache.has(kind)) return _glowCache.get(kind);
  const entry = basePalette[kind];
  const rgb = entry?.glow ? hexToRGB(entry.glow) : null;
  _glowCache.set(kind, rgb);
  return rgb;
}

// ---- Colour palettes for light sources ----------------------------------
// Explicit constants for effects that don't map 1:1 to a palette entry.
// EYE_LIGHT removed — eyesight is a vision mask, not a light source.
const WARM_ORANGE  = [255, 190, 120];   // player torch / generic torch
const LANTERN_GOLD = [255, 210, 140];   // lantern — slightly brighter, warmer
const FIRE_RED     = [255, 120, 40];    // burning entities / fire hazards
const STORM_WHITE  = [200, 210, 255];   // lightning / storm effects
const SOUL_GREEN   = [80, 255, 120];    // soul / nature magic
const BLOOD_RED    = [255, 50, 50];     // blood magic
const VENOM_GREEN  = [120, 255, 80];    // venom / poison glow
const HOLY_GOLD    = [255, 240, 180];   // invulnerable / divine
const CAUSTIC_LIME = [180, 255, 60];    // caustic effects
const SHADOW_PURPLE = [160, 80, 220];   // shadow / agony magic
const GAZE_VIOLET   = [220, 80, 255];  // floating eye gaze beam
const CHEST_GOLD    = [255, 230, 140];  // chest reveal bloom

// ---- Transient light state (event-driven) --------------------------------

// Floating eye gaze beams — tracked per eye entity ID.
// Each entry stores the eye position and charge progress (0–1).
/** @type {Map<number, {ex:number, ey:number, charge:number, total:number}>} */
const _gazeBeams = new Map();

// Chest reveal blooms — brief one-shot flashes.
/** @type {Array<{x:number, y:number, age:number, maxAge:number, color:[number,number,number]}>} */
const _chestBlooms = [];

/**
 * Apply a named temporal pattern to a light definition and push it.
 * Evaluates the pattern waveform, applies intensity to radius/flicker,
 * and applies color shift to the base color.
 *
 * @param {LightDef[]} out — array to push into
 * @param {string} pattern — temporal pattern name (e.g. 'torch', 'breathe')
 * @param {number} t — fxTime in seconds
 * @param {number} id — entity id for phase offset
 * @param {number} x @param {number} y
 * @param {number} baseRadius
 * @param {[number,number,number]} baseColor
 * @param {number} softness
 */
function emitPatterned(out, pattern, t, id, x, y, baseRadius, baseColor, softness) {
  const p = evaluatePattern(pattern, t, id);
  const r = Math.max(0, Math.min(255, baseColor[0] * (1 + p.r)));
  const g = Math.max(0, Math.min(255, baseColor[1] * (1 + p.g)));
  const b = Math.max(0, Math.min(255, baseColor[2] * (1 + p.b)));
  out.push({
    x, y,
    radius: baseRadius,
    color: [r, g, b],
    flicker: p.intensity,
    softness,
  });
}

/** Legacy shim — delegates to the 'torch' temporal pattern.  */
function torchFlicker(t, id) {
  return evaluatePattern('torch', t, id).intensity;
}

/**
 * Collect every active light source from the current WorldView.
 *
 * @param {import('../../../bridge/schema/worldView.js').WorldView} view
 * @param {{quality?: string, fxTime?: number}} opts
 * @returns {LightDef[]}
 */
// ---- Smooth eye-light radius (frame-interpolated between turns) ----------
// The rules layer updates visionRange once per turn (integer ticks), so blind
// recovery produces a staircase: 2 → 3 → 4 → ...  We lerp toward the target
// each frame so the lighting circle grows/shrinks smoothly in sub-tile space.
let _eyeRadiusCurrent = -1;   // < 0 = uninitialised
let _eyeRadiusTarget  = 0;
const EYE_LERP_SPEED  = 3.0;  // tiles/sec — fast enough to track, slow enough to read

/** Current smooth eye-light radius (tiles). Used by the tile renderer to
 *  fade glyph alpha near the vision boundary during blind recovery. */
export function getSmoothedEyeRadius() { return _eyeRadiusCurrent < 0 ? 0 : _eyeRadiusCurrent; }

/** @type {import('../engine.js').VisionDef|null} */
let _lastVisionDef = null;

/** Return the current vision mask definition (built during collectLightSources). */
export function getVisionDef() { return _lastVisionDef; }

export function collectLightSources(view, opts = {}) {
  const q     = (opts.quality || 'auto').toLowerCase();
  const base  = q === 'low' ? 6 : (q === 'high' ? 10 : 8);
  const t     = opts.fxTime || 0;
  const dt    = opts.dt || 0.016;   // frame delta (seconds)
  /** @type {LightDef[]} */
  const out   = [];
  const playerId = Number(view.player?.id || 0) | 0;

  // ---- Player vision (NOT a light — handled separately as vision mask) ----
  // Smooth the eye radius between frames for blind recovery transitions.
  if (view.player) {
    const px = view.player.pos.x + 0.5, py = view.player.pos.y + 0.5;
    const vr = view.playerVisionRadius || 0;

    _eyeRadiusTarget = vr;
    if (_eyeRadiusCurrent < 0) _eyeRadiusCurrent = vr;
    const diff = _eyeRadiusTarget - _eyeRadiusCurrent;
    if (Math.abs(diff) < 0.01) {
      _eyeRadiusCurrent = _eyeRadiusTarget;
    } else {
      _eyeRadiusCurrent += Math.sign(diff) * Math.min(Math.abs(diff), EYE_LERP_SPEED * dt);
    }

    // Build vision def for the engine (exported via getVisionDef)
    if (_eyeRadiusCurrent > 0) {
      const facing = view.playerFacing;
      const coneDeg = view.playerConeDegrees || 360;
      _lastVisionDef = {
        x: px, y: py,
        radius: _eyeRadiusCurrent + 0.5,
        facingX: facing ? facing.dx : 0,
        facingY: facing ? facing.dy : 0,
        coneDeg: coneDeg,
        penumbraDeg: 25,
      };
    } else {
      _lastVisionDef = null;
    }

    // ---- Torch light (warm, flickering) ----------------------------------
    // Below 25% HP the torch shifts to a heartbeat rhythm and dims red.
    // Below 10% HP the heartbeat slows further.
    if (Array.isArray(view.entities)) {
      for (let i = 0; i < view.entities.length; i++) {
        const e = view.entities[i];
        if ((Number(e.id || 0) | 0) !== playerId) continue;
        if (Array.isArray(e.tags) && e.tags.includes('torch')) {
          const hp = e.hp || 0, maxHp = e.maxHp || 1;
          const hpRatio = hp / maxHp;
          if (hpRatio <= 0.10) {
            // Critical — slow heartbeat, deep red, dimmer
            const CRIT_RED = [255, 60, 30];
            emitPatterned(out, 'heartbeat', t * 0.6, playerId, px, py, base * 0.6, CRIT_RED, 12);
          } else if (hpRatio <= 0.25) {
            // Low HP — heartbeat, orange-red shift, slightly reduced radius
            const LOW_RED = [255, 130, 60];
            emitPatterned(out, 'heartbeat', t, playerId, px, py, base * 0.8, LOW_RED, 14);
          } else {
            emitPatterned(out, 'torch', t, playerId, px, py, base + 0.5, WARM_ORANGE, 16);
          }
        }
        break;
      }
    }
  }

  // ---- Entity-derived lights --------------------------------------------
  if (Array.isArray(view.entities)) {
    for (let i = 0; i < view.entities.length; i++) {
      const e = view.entities[i];
      if ((Number(e.id || 0) | 0) === playerId) continue; // player handled above
      const tags = Array.isArray(e.tags) ? e.tags : null;
      // Memory echoes (explored but not currently visible) must not emit light.
      // The player remembers the decoration is there, but it shouldn't illuminate.
      if (tags && (tags.includes('memory_fixed') || tags.includes('memory_recent')
                || tags.includes('memory_esp') || tags.includes('memory_thermal'))) continue;
      const ex = e.pos.x + 0.5, ey = e.pos.y + 0.5;
      const layer = Number.isFinite(e.layer) ? (e.layer | 0) : 300;
      const kind = (typeof e.kind === 'string') ? e.kind.toLowerCase() : '';

      // Placed torches — room features (layer 300) or ground items (layer 250)
      if (kind === 'torch') {
        emitPatterned(out, 'torch', t, e.id, ex, ey, 6, WARM_ORANGE, 16);
        continue;
      }

      // Lit lantern posts (placed world objects)
      if (kind === 'lantern_post') {
        emitPatterned(out, 'candle', t, e.id, ex, ey, 7, LANTERN_GOLD, 20);
        continue;
      }

      // Dungeon furniture — palette-driven atmospheric lighting.
      // Each kind gets a temporal pattern that matches its character.
      {
        const FURNITURE_LIGHT = {
          fountain:    { radius: 3.5, pattern: 'breathe' },
          altar:       { radius: 4.5, pattern: 'breathe', softness: 8 },
          shrine:      { radius: 4,   pattern: 'holy',   softness: 8 },
          mushrooms:   { radius: 3,   pattern: 'biolum' },
        };
        const fl = FURNITURE_LIGHT[kind];
        if (fl) {
          const col = paletteGlow(kind) || [160, 170, 190];
          emitPatterned(out, fl.pattern, t, e.id, ex, ey, fl.radius, col, fl.softness || 12);
          continue;
        }
        // Fire-based furniture — flickering, palette-coloured
        if (kind === 'cooking_fire') {
          emitPatterned(out, 'torch', t, e.id, ex, ey, 4, paletteGlow(kind) || FIRE_RED, 16);
          continue;
        }
        if (kind === 'furnace') {
          emitPatterned(out, 'ember', t, e.id, ex, ey, 3, paletteGlow(kind) || FIRE_RED, 16);
          continue;
        }
      }

      if (!tags) continue;

      // Torch-bearing NPCs/monsters
      if (tags.includes('torch')) {
        emitPatterned(out, 'torch', t, e.id, ex, ey, 3, WARM_ORANGE, 14);
        continue; // torch dominates — skip weaker tags
      }

      // Tag-driven emissive lights — each magical school gets its own pattern.
      if (tags.includes('invulnerable')) {
        emitPatterned(out, 'holy', t, e.id, ex, ey, 5, HOLY_GOLD, 10);
      } else if (tags.includes('storm_glowing')) {
        emitPatterned(out, 'storm', t, e.id, ex, ey, 4, STORM_WHITE, 6);
      } else if (tags.includes('soul_glowing')) {
        emitPatterned(out, 'occult', t, e.id, ex, ey, 4, SOUL_GREEN, 8);
      } else if (tags.includes('blood_glowing')) {
        emitPatterned(out, 'heartbeat', t, e.id, ex, ey, 3, BLOOD_RED, 6);
      } else if (tags.includes('venom_glowing')) {
        emitPatterned(out, 'biolum', t, e.id, ex, ey, 3, VENOM_GREEN, 6);
      } else if (tags.includes('caustic_glowing')) {
        emitPatterned(out, 'pulse', t, e.id, ex, ey, 3, CAUSTIC_LIME, 6);
      } else if (tags.includes('agony')) {
        emitPatterned(out, 'occult', t, e.id, ex, ey, 3, SHADOW_PURPLE, 8);
      } else if (tags.includes('legendary_glowing')) {
        emitPatterned(out, 'pulse', t, e.id, ex, ey, 5, paletteGlow('legendary_chest') || LANTERN_GOLD, 10);
      } else if (tags.includes('glowing')) {
        emitPatterned(out, 'ember', t, e.id, ex, ey, 4, LANTERN_GOLD, 8);
      } else if (tags.includes('epic_glowing')) {
        emitPatterned(out, 'breathe', t, e.id, ex, ey, 4, paletteGlow('epic_chest') || [200, 100, 255], 8);
      } else if (tags.includes('rare_glowing')) {
        emitPatterned(out, 'breathe', t, e.id, ex, ey, 3, paletteGlow('magic_chest') || [100, 160, 255], 6);
      }
      // Potion glow — bioluminescent shimmer
      if (tags.includes('potion_glow')) {
        const col = paletteGlow(kind) || paletteGlow('potion') || [120, 220, 200];
        emitPatterned(out, 'biolum', t, e.id, ex, ey, 2.5, col, 6);
      }
      // Gold glow — gentle pulse
      if (tags.includes('gold_glow')) {
        emitPatterned(out, 'candle', t, e.id, ex, ey, 1.5, [255, 210, 80], 4);
      }
      // Gem glow — slow breathe
      if (tags.includes('gem_glowing')) {
        const col = paletteGlow(kind) || [200, 150, 255];
        emitPatterned(out, 'breathe', t, e.id, ex, ey, 3, col, 6);
      }
      // Burning entities — fire light that reads as something on fire
      if (tags.includes('burning')) {
        emitPatterned(out, 'ember', t, e.id, ex, ey, 3.5, FIRE_RED, 12);
      }

      // Floating eye gaze beams — directional cone from eye toward player.
      // Tightens as charge builds: wide idle scan → tight focused beam.
      if (_gazeBeams.has((e.id | 0))) {
        const gb = _gazeBeams.get(e.id | 0);
        // Update eye position each frame (it may move)
        gb.ex = ex; gb.ey = ey;
      }
    }
  }

  // ---- Floating eye gaze cone lights ------------------------------------
  // Prune beams for eyes no longer visible (dead, LOS broken, off-screen).
  if (_gazeBeams.size > 0) {
    const visibleIds = new Set();
    if (Array.isArray(view.entities)) {
      for (let i = 0; i < view.entities.length; i++) {
        visibleIds.add(view.entities[i].id | 0);
      }
    }
    for (const eyeId of _gazeBeams.keys()) {
      if (!visibleIds.has(eyeId)) _gazeBeams.delete(eyeId);
    }
  }
  if (view.player && _gazeBeams.size > 0) {
    const px = view.player.pos.x + 0.5, py = view.player.pos.y + 0.5;
    for (const [, gb] of _gazeBeams) {
      const progress = Math.min(1, gb.charge / Math.max(1, gb.total));
      // Occult temporal pattern for unsettling rhythm
      const pSeed = (gb.ex * 73 + gb.ey * 37) | 0;
      const p = evaluatePattern('occult', t, pSeed);
      const baseInt = 0.7 + progress * 0.5;
      const intensity = baseInt * p.intensity;

      // Hot source glow at the eye — grows with charge, overdriven
      const eyeRadius = 1.5 + progress * 2.0;
      const eyeCol = [
        Math.min(255, GAZE_VIOLET[0] * intensity * 1.6),
        Math.min(255, GAZE_VIOLET[1] * intensity * 1.6),
        Math.min(255, GAZE_VIOLET[2] * intensity * 1.6),
      ];
      out.push({ x: gb.ex, y: gb.ey, radius: eyeRadius, color: eyeCol, softness: 10 });

      // Light beam — tight half-tile-wide beam, high intensity.
      // Radius 0.5 tiles per sample, spaced every 0.5 tiles so they
      // overlap into a continuous ~½ tile wide laser line.
      const dx = px - gb.ex, dy = py - gb.ey;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.5) continue;  // too close, skip beam
      const nx = dx / dist, ny = dy / dist;
      const spacing = 0.5;
      const steps = Math.min(24, Math.floor(dist / spacing));
      const beamRadius = 0.5;
      for (let s = 1; s <= steps; s++) {
        const frac = (s * spacing) / dist;
        // Barely fades along length — stays hot all the way
        const falloff = 1.0 - frac * 0.15;
        const bInt = intensity * falloff * 1.4;
        // Per-sample shimmer — offset the occult pattern per step
        const sp = evaluatePattern('occult', t, pSeed + s * 17);
        const shimmer = 0.88 + 0.12 * sp.intensity;
        const bi = bInt * shimmer;
        out.push({
          x: gb.ex + nx * s * spacing,
          y: gb.ey + ny * s * spacing,
          radius: beamRadius,
          color: [
            Math.min(255, GAZE_VIOLET[0] * bi),
            Math.min(255, GAZE_VIOLET[1] * bi),
            Math.min(255, GAZE_VIOLET[2] * bi),
          ],
          softness: 4,
        });
      }
    }
  }

  // ---- Chest reveal blooms (one-shot fading flashes) --------------------
  for (let i = _chestBlooms.length - 1; i >= 0; i--) {
    const bl = _chestBlooms[i];
    bl.age += dt;
    if (bl.age >= bl.maxAge) {
      _chestBlooms.splice(i, 1);
      continue;
    }
    const life = 1 - bl.age / bl.maxAge;
    const fade = life * life;  // quadratic fade-out
    out.push({
      x: bl.x, y: bl.y,
      radius: 4 * fade + 1,
      color: [bl.color[0] * fade, bl.color[1] * fade, bl.color[2] * fade],
      softness: 10,
    });
  }

  return out;
}

/**
 * Append transient lights from active spell / FX controllers.
 *
 * @param {LightDef[]} out — array to push into (mutated)
 * @param {object} fxSources — keyed FX controllers with getActiveLights()
 */
export function collectFxLights(out, fxSources) {
  // Query each FX controller for active light sources
  const controllers = [fxSources.boltFx, fxSources.spellAreaFx, fxSources.projectileFx, fxSources.cloudFx, fxSources.surfaceAreaFx, fxSources.statusEmitterFx];
  for (let c = 0; c < controllers.length; c++) {
    const fx = controllers[c];
    if (fx && typeof fx.getActiveLights === 'function') {
      const active = fx.getActiveLights();
      for (let i = 0; i < active.length; i++) out.push(active[i]);
    }
  }
}

/**
 * Install event listeners for transient lighting effects.
 * Call once during display initialization, passing the world event bus
 * and a getPosition callback for entity coordinate lookup.
 *
 * @param {object} world — world with .on() event method
 * @param {(id:number) => {x:number,y:number}|null} getPosition
 */
export function installLightEventListeners(world, getPosition) {
  // Floating eye gaze — track charge build-up per eye entity
  world.on('proc:gaze:charged', ({ actor, target, chargeCount, total }) => {
    const eyeId = Number(actor) | 0;
    const pos = getPosition(eyeId);
    if (!pos) return;
    _gazeBeams.set(eyeId, {
      ex: pos.x + 0.5, ey: pos.y + 0.5,
      charge: chargeCount,
      total: total || 8,
    });
  });

  // Gaze stun fires — bright flash then clear the beam
  world.on('proc:gaze:stun', ({ actor }) => {
    const eyeId = Number(actor) | 0;
    const gb = _gazeBeams.get(eyeId);
    if (gb) {
      // One-shot flash bloom at the eye position
      _chestBlooms.push({
        x: gb.ex, y: gb.ey, age: 0, maxAge: 0.3,
        color: [220, 80, 255],
      });
    }
    _gazeBeams.delete(eyeId);
  });

  // Clear gaze beams on level transition
  world.on('dungeon:transitioned', () => {
    _gazeBeams.clear();
    _chestBlooms.length = 0;
  });

  // Chest reveal bloom — brief upward light flash on open
  world.on('chest:open', ({ targetId }) => {
    const pos = getPosition(Number(targetId) | 0);
    if (!pos) return;
    // Color based on chest kind — default warm gold
    _chestBlooms.push({
      x: pos.x + 0.5, y: pos.y + 0.5,
      age: 0, maxAge: 0.45,
      color: [CHEST_GOLD[0], CHEST_GOLD[1], CHEST_GOLD[2]],
    });
  });
}

// ---- Overworld positional sky lights (sun / moon) -----------------------
//
// Both bodies are modelled as infinitely distant directional lights whose
// elevation above the horizon is a sine arc driven by turnInDay.
//
// Sun arc:  rises at SUNRISE (turn 150 / 5 AM), peaks at solar noon,
//           sets at SUNSET (turn 580 / ~7:20 PM).
// Moon arc: rises at SUNSET, peaks at midnight (turn 0 / 720),
//           sets at SUNRISE.  Intensity scaled by lunar phase.
//
// Elevation drives both intensity (sin of elevation angle) and colour
// (low elevation = warm horizon tint, high = neutral white / cool blue).

// Sun / moon arc boundaries (turns within a day)
const SUNRISE = 150;   // 5 AM   — sun clears horizon
const SUNSET  = 580;   // 7:20 PM — sun dips below horizon
const SUN_ARC = SUNSET - SUNRISE;                          // 430 turns of daylight
const MOON_ARC = TURNS_PER_DAY - SUNSET + SUNRISE;         // 290 turns of moonlight

// Colour palettes (linear RGB, 0-1)
const SUN_ZENITH  = [0.95, 0.93, 0.88];   // overhead — near-white with slight warmth
const SUN_HORIZON = [1.00, 0.55, 0.20];   // low sun  — golden-amber (dawn/dusk only)
const MOON_ZENITH = [0.18, 0.20, 0.35];   // overhead — cool blue-white
const MOON_HORIZON = [0.08, 0.08, 0.18];  // low moon — dim indigo

/** Lerp two RGB triplets. */
function lerpRGB(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/**
 * Compute elevation (0-1) of a celestial body given a sine arc.
 * Returns 0 when below the horizon.
 */
function arcElevation(turnInDay, arcStart, arcLen) {
  // Normalise turnInDay into the arc's local phase (0 → 1)
  let t;
  if (arcStart + arcLen <= TURNS_PER_DAY) {
    // Arc doesn't wrap midnight
    if (turnInDay < arcStart || turnInDay >= arcStart + arcLen) return 0;
    t = (turnInDay - arcStart) / arcLen;
  } else {
    // Arc wraps midnight (moon)
    const end = (arcStart + arcLen) % TURNS_PER_DAY;
    if (turnInDay >= arcStart) {
      t = (turnInDay - arcStart) / arcLen;
    } else if (turnInDay < end) {
      t = (turnInDay + TURNS_PER_DAY - arcStart) / arcLen;
    } else {
      return 0;
    }
  }
  return Math.sin(t * Math.PI);   // 0 at horizon, 1 at zenith
}

/**
 * Compute the overworld ambient sky-light colour from positional sun/moon.
 * Returns `null` when underground (no ambient).
 *
 * @param {import('../../../bridge/schema/worldView.js').WorldView} view
 * @returns {[number,number,number]|null}
 */
export function computeAmbient(view) {
  // Underground — no ambient sky light
  if (!view.isOverworld) return null;

  const tid = view.turnInDay || 0;

  // ---- Sun contribution ------------------------------------------------
  const sunElev = arcElevation(tid, SUNRISE, SUN_ARC);
  let sr = 0, sg = 0, sb = 0;
  if (sunElev > 0) {
    // Horizon tint compressed to low elevations via power curve.
    // At elev 0.3 the blend is already ~90% zenith; midday is pure white.
    const horizonBlend = Math.pow(1 - sunElev, 3);
    const col = lerpRGB(SUN_ZENITH, SUN_HORIZON, horizonBlend);
    sr = col[0] * sunElev;
    sg = col[1] * sunElev;
    sb = col[2] * sunElev;
  }

  // ---- Moon contribution -----------------------------------------------
  const moonElev = arcElevation(tid, SUNSET, MOON_ARC);
  let mr = 0, mg = 0, mb = 0;
  if (moonElev > 0) {
    const brightness = view.moonBrightness || 0.15;
    const horizonBlend = Math.pow(1 - moonElev, 3);
    const col = lerpRGB(MOON_ZENITH, MOON_HORIZON, horizonBlend);
    mr = col[0] * moonElev * brightness;
    mg = col[1] * moonElev * brightness;
    mb = col[2] * moonElev * brightness;
  }

  // Additive blend — during twilight both may contribute briefly
  return [sr + mr, sg + mg, sb + mb];
}
