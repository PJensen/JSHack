// display/fx/slideFxController.js
// Smoothly interpolates entity positions between tile snaps.
// Each entity gets a movement profile based on its sizeClass, controlling
// slide duration and easing curve so small creatures dart and large ones lumber.

/** @typedef {{ fromX:number, fromY:number, toX:number, toY:number, elapsed:number, duration:number, easing:string }} SlideState */

// ── Size-class movement profiles ─────────────────────────────────────
// duration = seconds for the slide; easing = curve shape
const PROFILES = {
  XS:  { duration: 0.080, easing: 'snap'    },   // dart / jitter
  S:   { duration: 0.090, easing: 'outQuart' },   // scurry
  M:   { duration: 0.105, easing: 'outCubic' },   // stride
  L:   { duration: 0.140, easing: 'outQuad'  },   // lumber
  XL:  { duration: 0.180, easing: 'outQuad'  },   // trudge
};
const DEFAULT_PROFILE = PROFILES.M;

// ── Easing functions ─────────────────────────────────────────────────
function clamp01(n) {
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

function easeOutQuad(t)  { return 1 - (1 - t) * (1 - t); }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }
function easeSnap(t)     { return t < 0.3 ? t / 0.3 : 1; }   // fast snap then hold

const EASINGS = {
  outQuad:  easeOutQuad,
  outCubic: easeOutCubic,
  outQuart: easeOutQuart,
  snap:     easeSnap,
};

// ── Controller ───────────────────────────────────────────────────────
export function createSlideFxController() {
  /** @type {Map<number, SlideState>} */
  const states = new Map();

  /** @type {Map<number, {x:number, y:number}>} */
  const lastKnown = new Map();

  /**
   * Called once per frame with the full entity list from worldView.
   * Detects position changes and starts slide animations.
   * @param {Array<{id:number, pos:{x:number,y:number}, sizeClass?:string, layer?:number}>} entities
   */
  function syncWorldView(entities) {
    if (!Array.isArray(entities)) return;
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      const id = e.id;
      const ex = e.pos.x;
      const ey = e.pos.y;
      const prev = lastKnown.get(id);

      if (!prev) {
        // First time seeing this entity — just record, no slide
        lastKnown.set(id, { x: ex, y: ey });
        continue;
      }

      // Check if position actually changed (integer tile coords)
      if (prev.x === ex && prev.y === ey) continue;

      // Position changed — start a slide from old position to new
      const profile = PROFILES[e.sizeClass] || DEFAULT_PROFILE;

      // If already sliding, chain from current visual position
      const existing = states.get(id);
      let fromX = prev.x;
      let fromY = prev.y;
      if (existing && existing.elapsed < existing.duration) {
        const t = clamp01(existing.elapsed / existing.duration);
        const easeFn = EASINGS[existing.easing] || easeOutCubic;
        const p = easeFn(t);
        fromX = existing.fromX + (existing.toX - existing.fromX) * p;
        fromY = existing.fromY + (existing.toY - existing.fromY) * p;
      }

      states.set(id, {
        fromX,
        fromY,
        toX: ex,
        toY: ey,
        elapsed: 0,
        duration: profile.duration,
        easing: profile.easing,
      });

      prev.x = ex;
      prev.y = ey;
    }
  }

  /**
   * Advance all active slides by dt seconds.
   * @param {number} dt
   */
  function tick(dt) {
    for (const [id, s] of states) {
      s.elapsed += dt;
      if (s.elapsed >= s.duration) {
        states.delete(id);
      }
    }
  }

  /**
   * Get the interpolated display position for an entity.
   * Returns the entity's logical position if no slide is active.
   * @param {number} id
   * @param {number} logicalX
   * @param {number} logicalY
   * @returns {{ x:number, y:number, sliding:boolean }}
   */
  function getPosition(id, logicalX, logicalY) {
    const s = states.get(id);
    if (!s) return { x: logicalX, y: logicalY, sliding: false };

    const t = clamp01(s.elapsed / s.duration);
    const easeFn = EASINGS[s.easing] || easeOutCubic;
    const p = easeFn(t);

    return {
      x: s.fromX + (s.toX - s.fromX) * p,
      y: s.fromY + (s.toY - s.fromY) * p,
      sliding: true,
    };
  }

  /**
   * Remove tracking for a dead/despawned entity.
   * @param {number} id
   */
  function remove(id) {
    states.delete(id);
    lastKnown.delete(id);
  }

  return { syncWorldView, tick, getPosition, remove };
}
