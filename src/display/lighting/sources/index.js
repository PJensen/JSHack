// display/lighting/sources/index.js
// Collect display-side light sources from a WorldView snapshot.
// Returns LightDef[] compatible with the lighting engine.

/** @typedef {import('../engine.js').LightDef} LightDef */

// ---- Colour palettes for light sources ----------------------------------
const WARM_ORANGE  = [255, 190, 120];   // player torch / generic torch
const LANTERN_GOLD = [255, 210, 140];   // lantern — slightly brighter, warmer
const FIRE_RED     = [255, 120, 40];    // burning entities / fire hazards
const FROST_BLUE   = [140, 200, 255];   // frost effects
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

  // ---- Player light (always present) ------------------------------------
  if (view.player) {
    const px = view.player.pos.x, py = view.player.pos.y;
    // Check if player entity has a torch or lantern tag
    let playerHasTorch   = false;
    let playerHasLantern = false;
    if (Array.isArray(view.entities)) {
      for (let i = 0; i < view.entities.length; i++) {
        const e = view.entities[i];
        if ((Number(e.id || 0) | 0) !== playerId) continue;
        if (Array.isArray(e.tags)) {
          playerHasTorch   = e.tags.includes('torch');
          // Lantern doesn't project a tag today; just check for visionRange bonus presence
          // via a larger base radius when not holding torch.
        }
        break;
      }
    }

    if (playerHasTorch) {
      const f = torchFlicker(t, playerId);
      out.push({ x: px, y: py, radius: base * f, color: WARM_ORANGE, flicker: f });
    } else {
      // Ambient player glow (lantern / innate sight) — steady, slightly smaller
      out.push({ x: px, y: py, radius: base * 0.85, color: LANTERN_GOLD, flicker: 1 });
    }
  }

  // ---- Entity-derived lights --------------------------------------------
  if (Array.isArray(view.entities)) {
    for (let i = 0; i < view.entities.length; i++) {
      const e = view.entities[i];
      if ((Number(e.id || 0) | 0) === playerId) continue; // player handled above
      const tags = e.tags;
      if (!Array.isArray(tags)) continue;
      const ex = e.pos.x, ey = e.pos.y;

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

      // Tag-driven emissive lights
      if (tags.includes('invulnerable')) {
        out.push({ x: ex, y: ey, radius: 5, color: HOLY_GOLD });
      } else if (tags.includes('frost_glowing')) {
        out.push({ x: ex, y: ey, radius: 4, color: FROST_BLUE });
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
 * Called separately so main.js can feed in whatever FX systems it wants.
 *
 * @param {LightDef[]} out — array to push into (mutated)
 * @param {object} fxSources — keyed FX controllers
 * @param {number} fxTime
 */
export function collectFxLights(out, fxSources, fxTime) {
  // Bolt FX — lightning strikes emit bright white-blue flash
  if (fxSources.boltFx) {
    const bolts = fxSources.boltFx;
    if (typeof bolts.getActiveBolts === 'function') {
      const active = bolts.getActiveBolts();
      for (let i = 0; i < active.length; i++) {
        const b = active[i];
        out.push({ x: b.x, y: b.y, radius: 8, color: STORM_WHITE, flicker: 0.6 + 0.4 * Math.random() });
      }
    }
  }

  // Spell area FX — meteor, blastwave, etc.
  if (fxSources.spellAreaFx) {
    const fx = fxSources.spellAreaFx;
    if (typeof fx.getActiveLights === 'function') {
      const active = fx.getActiveLights();
      for (let i = 0; i < active.length; i++) {
        out.push(active[i]);
      }
    }
  }

  // Projectile FX — frost bolts, fireballs in flight
  if (fxSources.projectileFx) {
    const fx = fxSources.projectileFx;
    if (typeof fx.getActiveLights === 'function') {
      const active = fx.getActiveLights();
      for (let i = 0; i < active.length; i++) {
        out.push(active[i]);
      }
    }
  }

  // Cloud FX — fire, poison, plasma clouds
  if (fxSources.cloudFx) {
    const fx = fxSources.cloudFx;
    if (typeof fx.getActiveLights === 'function') {
      const active = fx.getActiveLights();
      for (let i = 0; i < active.length; i++) {
        out.push(active[i]);
      }
    }
  }
}
