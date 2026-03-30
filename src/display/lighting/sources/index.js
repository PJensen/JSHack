// display/lighting/sources/index.js
// Collect display-side light sources from a WorldView snapshot.
// Returns LightDef[] compatible with the lighting engine.

/** @typedef {import('../engine.js').LightDef} LightDef */

import { basePalette } from '../../palette/base.js';

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

/**
 * Torch flicker — deterministic per-entity wobble + random jitter.
 * @param {number} t  — current fxTime (seconds)
 * @param {number} id — entity id for phase offset
 * @returns {number}  — multiplier ≈ 0.75 – 1.15
 */
function torchFlicker(t, id) {
  return 1.0
    + 0.10 * Math.sin(t * 1.4  + id)       // slow sway
    + 0.06 * Math.sin(t * 3.1  + id * 0.7) // medium wobble
    + 0.04 * Math.sin(t * 5.9)              // subtle shimmer
    + 0.04 * (Math.random() - 0.5);         // gentle jitter
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
    if (Array.isArray(view.entities)) {
      for (let i = 0; i < view.entities.length; i++) {
        const e = view.entities[i];
        if ((Number(e.id || 0) | 0) !== playerId) continue;
        if (Array.isArray(e.tags) && e.tags.includes('torch')) {
          const f = torchFlicker(t, playerId);
          out.push({ x: px, y: py, radius: base * f + 0.5, color: WARM_ORANGE, flicker: f });
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
        const f = torchFlicker(t, e.id);
        out.push({ x: ex, y: ey, radius: 6 * f, color: WARM_ORANGE, flicker: f });
        continue;
      }

      // Lit lantern posts (placed world objects)
      if (kind === 'lantern_post') {
        const f = torchFlicker(t, e.id);
        out.push({ x: ex, y: ey, radius: 7 * f, color: LANTERN_GOLD, flicker: f });
        continue;
      }

      // Dungeon furniture — palette-driven atmospheric lighting.
      // Radius is hand-tuned per kind; colour comes from the glyph palette glow.
      {
        const FURNITURE_LIGHT = {
          fountain:    { radius: 2.5 },
          altar:       { radius: 2 },
          shrine:      { radius: 2 },
          mushrooms:   { radius: 2 },
          stair_down:  { radius: 2 },
          stair_up:    { radius: 2 },
        };
        const fl = FURNITURE_LIGHT[kind];
        if (fl) {
          const col = paletteGlow(kind) || [160, 170, 190];
          out.push({ x: ex, y: ey, radius: fl.radius, color: col });
          continue;
        }
        // Fire-based furniture — flickering, palette-coloured
        if (kind === 'cooking_fire' || kind === 'furnace') {
          const r = kind === 'cooking_fire' ? 4 : 3;
          const f = torchFlicker(t, e.id);
          const col = paletteGlow(kind) || FIRE_RED;
          out.push({ x: ex, y: ey, radius: r * f, color: col, flicker: f });
          continue;
        }
      }

      if (!tags) continue;

      // Torch-bearing NPCs/monsters
      if (tags.includes('torch')) {
        const f = torchFlicker(t, e.id);
        out.push({ x: ex, y: ey, radius: 5 * f, color: WARM_ORANGE, flicker: f });
        continue; // torch dominates — skip weaker tags
      }

      // Burning entities — flickering fire
      if (tags.includes('burning')) {
        const f = torchFlicker(t, e.id);
        out.push({ x: ex, y: ey, radius: 4 * f, color: FIRE_RED, flicker: f });
        continue;
      }

      // Tag-driven emissive lights (frost deliberately excluded — cold ≠ light)
      if (tags.includes('invulnerable')) {
        out.push({ x: ex, y: ey, radius: 5, color: HOLY_GOLD });
      } else if (tags.includes('storm_glowing')) {
        out.push({ x: ex, y: ey, radius: 4, color: STORM_WHITE });
      } else if (tags.includes('soul_glowing')) {
        out.push({ x: ex, y: ey, radius: 4, color: SOUL_GREEN });
      } else if (tags.includes('blood_glowing')) {
        out.push({ x: ex, y: ey, radius: 3, color: BLOOD_RED });
      } else if (tags.includes('venom_glowing')) {
        out.push({ x: ex, y: ey, radius: 3, color: VENOM_GREEN });
      } else if (tags.includes('caustic_glowing')) {
        out.push({ x: ex, y: ey, radius: 3, color: CAUSTIC_LIME });
      } else if (tags.includes('agony')) {
        out.push({ x: ex, y: ey, radius: 3, color: SHADOW_PURPLE });
      } else if (tags.includes('legendary_glowing')) {
        out.push({ x: ex, y: ey, radius: 3, color: paletteGlow('legendary_chest') || LANTERN_GOLD });
      } else if (tags.includes('glowing')) {
        out.push({ x: ex, y: ey, radius: 3, color: LANTERN_GOLD });
      } else if (tags.includes('epic_glowing')) {
        out.push({ x: ex, y: ey, radius: 2.5, color: paletteGlow('epic_chest') || [200, 100, 255] });
      } else if (tags.includes('rare_glowing')) {
        out.push({ x: ex, y: ey, radius: 1.5, color: paletteGlow('magic_chest') || [100, 160, 255] });
      }
      // Potion glow — very subtle shimmer, colour from the specific potion palette entry
      if (tags.includes('potion_glow')) {
        const col = paletteGlow(kind) || paletteGlow('potion') || [120, 220, 200];
        out.push({ x: ex, y: ey, radius: 1.5, color: col });
      }
      // Gold glow — compact golden gleam
      if (tags.includes('gold_glow')) {
        out.push({ x: ex, y: ey, radius: 1.2, color: [255, 210, 80] });
      }
      // Gem glow — color driven by palette entry for specific gem kind
      if (tags.includes('gem_glowing')) {
        const col = paletteGlow(kind) || [200, 150, 255];
        out.push({ x: ex, y: ey, radius: 1.8, color: col });
      }
    }
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
  const controllers = [fxSources.boltFx, fxSources.spellAreaFx, fxSources.projectileFx, fxSources.cloudFx];
  for (let c = 0; c < controllers.length; c++) {
    const fx = controllers[c];
    if (fx && typeof fx.getActiveLights === 'function') {
      const active = fx.getActiveLights();
      for (let i = 0; i < active.length; i++) out.push(active[i]);
    }
  }
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
