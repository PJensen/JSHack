// display/lighting/sources/index.js
// Collect display-side light sources from a WorldView snapshot.
// Returns LightDef[] compatible with the lighting engine.

/** @typedef {import('../engine.js').LightDef} LightDef */

// Mirror of rules/data/calendar.TURNS_PER_DAY — display layer cannot import
// rules directly.  The bridge (worldView) normalises time into turnInDay so
// this constant is only needed for the sun/moon arc boundaries below.
const TURNS_PER_DAY = 720;

// ---- Colour palettes for light sources ----------------------------------
const EYE_LIGHT    = [50, 50, 65];      // dim neutral sight (player vision range)
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
const EPIC_VIOLET  = [200, 100, 255];   // epic rarity
const RARE_BLUE    = [100, 160, 255];   // rare rarity
const POTION_TEAL  = [120, 220, 200];   // potion shimmer
const FOUNTAIN_BLUE = [100, 180, 230];  // water / fountain
const ALTAR_PURPLE = [200, 150, 255];   // altar / shrine divine
const SHRINE_GOLD  = [255, 220, 100];   // shrine warm glow
const MUSHROOM_CYAN = [80, 200, 160];   // bioluminescent fungi
const STAIR_GREY   = [160, 170, 190];   // mysterious passage

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
export function collectLightSources(view, opts = {}) {
  const q     = (opts.quality || 'auto').toLowerCase();
  const base  = q === 'low' ? 6 : (q === 'high' ? 10 : 8);
  const t     = opts.fxTime || 0;
  /** @type {LightDef[]} */
  const out   = [];
  const playerId = Number(view.player?.id || 0) | 0;

  // ---- Player eye-light (dim sight from vision range) ---------------------
  // Even without a torch the player can see dimly within their vision range.
  // This is natural eyesight — neutral, cool, low-intensity.  Equipment that
  // boosts visionRange (lantern +3) widens this circle automatically.
  if (view.player) {
    const px = view.player.pos.x, py = view.player.pos.y;
    const vr = view.playerVisionRadius || 0;
    if (vr > 0) {
      out.push({ x: px, y: py, radius: vr, color: EYE_LIGHT });
    }

    // ---- Torch light (warm, flickering, layered on top of eye-light) -----
    if (Array.isArray(view.entities)) {
      for (let i = 0; i < view.entities.length; i++) {
        const e = view.entities[i];
        if ((Number(e.id || 0) | 0) !== playerId) continue;
        if (Array.isArray(e.tags) && e.tags.includes('torch')) {
          const f = torchFlicker(t, playerId);
          out.push({ x: px, y: py, radius: base * f, color: WARM_ORANGE, flicker: f });
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
      const ex = e.pos.x, ey = e.pos.y;
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

      // Dungeon furniture — subtle atmospheric lighting
      if (kind === 'fountain') {
        out.push({ x: ex, y: ey, radius: 3, color: FOUNTAIN_BLUE });
        continue;
      }
      if (kind === 'altar') {
        out.push({ x: ex, y: ey, radius: 3, color: ALTAR_PURPLE });
        continue;
      }
      if (kind === 'shrine') {
        out.push({ x: ex, y: ey, radius: 3, color: SHRINE_GOLD });
        continue;
      }
      if (kind === 'mushrooms') {
        out.push({ x: ex, y: ey, radius: 2, color: MUSHROOM_CYAN });
        continue;
      }
      if (kind === 'stair_down' || kind === 'stair_up') {
        out.push({ x: ex, y: ey, radius: 2, color: STAIR_GREY });
        continue;
      }
      if (kind === 'cooking_fire') {
        const f = torchFlicker(t, e.id);
        out.push({ x: ex, y: ey, radius: 4 * f, color: FIRE_RED, flicker: f });
        continue;
      }
      if (kind === 'furnace') {
        const f = torchFlicker(t, e.id);
        out.push({ x: ex, y: ey, radius: 3 * f, color: FIRE_RED, flicker: f });
        continue;
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
      } else if (tags.includes('glowing') || tags.includes('legendary_glowing')) {
        out.push({ x: ex, y: ey, radius: 3, color: LANTERN_GOLD });
      } else if (tags.includes('epic_glowing')) {
        out.push({ x: ex, y: ey, radius: 2.5, color: EPIC_VIOLET });
      } else if (tags.includes('rare_glowing')) {
        out.push({ x: ex, y: ey, radius: 1.5, color: RARE_BLUE });
      }
      // Potion glow — very subtle shimmer on ground potions
      if (tags.includes('potion_glow')) {
        out.push({ x: ex, y: ey, radius: 1.5, color: POTION_TEAL });
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
