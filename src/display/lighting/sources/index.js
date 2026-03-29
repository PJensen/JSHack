// display/lighting/sources/index.js
// Collect display-side light sources from a WorldView snapshot.
// Returns LightDef[] compatible with the lighting engine.

/** @typedef {import('../engine.js').LightDef} LightDef */

// ---- Colour palettes for light sources ----------------------------------
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
    + 0.12 * Math.sin(t * 5.7  + id)
    + 0.08 * Math.sin(t * 13.3 + id)
    + 0.06 * Math.sin(t * 23.1)
    + 0.10 * (Math.random() - 0.5);
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

  // ---- Player light (only when carrying a torch in offhand) ---------------
  // The "torch" tag is projected onto the player entity by worldView when
  // Equipment.offhand holds a torch item.  No torch → no player light.
  if (view.player && Array.isArray(view.entities)) {
    const px = view.player.pos.x, py = view.player.pos.y;
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

  // ---- Entity-derived lights --------------------------------------------
  if (Array.isArray(view.entities)) {
    for (let i = 0; i < view.entities.length; i++) {
      const e = view.entities[i];
      if ((Number(e.id || 0) | 0) === playerId) continue; // player handled above
      const tags = Array.isArray(e.tags) ? e.tags : null;
      const ex = e.pos.x, ey = e.pos.y;
      const layer = Number.isFinite(e.layer) ? (e.layer | 0) : 300;
      const kind = (typeof e.kind === 'string') ? e.kind.toLowerCase() : '';

      // Ground torches (items on map) — flickering warm light
      if (layer === 250 && kind === 'torch') {
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

// ---- Overworld ambient (sun / moon) -------------------------------------

// Palette anchors (linear RGB, 0-1)
const SUN_DAY   = [0.95, 0.92, 0.85];   // bright warm white
const SUN_DAWN  = [1.00, 0.60, 0.25];   // golden-amber
const SUN_DUSK  = [0.85, 0.35, 0.12];   // orange-red
const MOON_NIGHT = [0.10, 0.12, 0.22];  // dim cool blue

/** Lerp two RGB triplets. */
function lerpRGB(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/**
 * Compute the overworld ambient light colour from worldView time-of-day
 * fields.  Returns `null` when underground (no ambient).
 *
 * @param {import('../../../bridge/schema/worldView.js').WorldView} view
 * @returns {[number,number,number]|null}
 */
export function computeAmbient(view) {
  // Underground — no ambient sky light
  if (!view.isOverworld) return null;

  const night = view.nightAlpha || 0;
  const dawn  = view.dawnAlpha  || 0;
  const dusk  = view.duskAlpha  || 0;

  // Start from the day/night base
  const base = lerpRGB(SUN_DAY, MOON_NIGHT, night);

  // Blend in dawn / dusk warmth on top (they peak as bell curves)
  if (dawn > 0.01) return lerpRGB(base, SUN_DAWN, dawn * 0.6);
  if (dusk > 0.01) return lerpRGB(base, SUN_DUSK, dusk * 0.6);
  return base;
}
