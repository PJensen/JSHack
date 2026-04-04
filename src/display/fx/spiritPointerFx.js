// display/fx/spiritPointerFx.js
// Screen-space spirit wisp flight effect.
//
// A small glowing DOM orb departs from the wisp's projected screen position,
// flies to a target UI button, pulses briefly at the destination, then fades.
// Entirely in CSS/DOM space — no canvas coupling.

const POINTER_CLASS = "jshack-spirit-pointer";

// ── Timing ────────────────────────────────────────────────────────────
const FLY_DURATION_MS = 600;
const PULSE_DURATION_MS = 900;
const FADE_DURATION_MS = 350;

// ── Sizing ────────────────────────────────────────────────────────────
const ORB_SIZE = 14; // px
const PULSE_RING_SIZE = 38; // px, ring that blooms on arrival

/**
 * @param {{
 *   getWispScreenPos: () => ({ x: number, y: number } | null),
 * }} deps
 */
export function createSpiritPointerFx({ getWispScreenPos }) {

  /** Remove any leftover pointer elements (defensive). */
  function _cleanup() {
    try {
      for (const el of document.querySelectorAll("." + POINTER_CLASS)) {
        el.remove();
      }
    } catch { /* ok */ }
  }

  /**
   * Fly a glowing orb from the wisp's current screen position to the center
   * of a target DOM element (usually an action-bar button).
   *
   * @param {string} targetSelector — CSS selector or element ID (e.g. "#btn-bag")
   */
  function flyTo(targetSelector) {
    if (!targetSelector) return;

    const target = document.querySelector(targetSelector) ||
      document.getElementById(targetSelector.replace(/^#/, ""));
    if (!target) return;

    const start = getWispScreenPos();
    if (!start) return;

    const rect = target.getBoundingClientRect();
    const endX = rect.left + rect.width / 2;
    const endY = rect.top + rect.height / 2;

    // ── Orb element ─────────────────────────────────────────────────
    const orb = document.createElement("div");
    orb.className = POINTER_CLASS;
    Object.assign(orb.style, {
      position: "fixed",
      zIndex: "9999",
      pointerEvents: "none",
      width: ORB_SIZE + "px",
      height: ORB_SIZE + "px",
      borderRadius: "50%",
      background: "radial-gradient(circle, rgba(180,230,255,0.95) 0%, rgba(120,200,255,0.6) 40%, rgba(80,180,255,0) 100%)",
      boxShadow: "0 0 8px 3px rgba(140,210,255,0.7), 0 0 18px 6px rgba(100,190,255,0.3)",
      left: (start.x - ORB_SIZE / 2) + "px",
      top: (start.y - ORB_SIZE / 2) + "px",
      transition: `left ${FLY_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), top ${FLY_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${FADE_DURATION_MS}ms ease`,
      opacity: "1",
    });
    document.body.appendChild(orb);

    // ── Animate flight ──────────────────────────────────────────────
    requestAnimationFrame(() => {
      orb.style.left = (endX - ORB_SIZE / 2) + "px";
      orb.style.top = (endY - ORB_SIZE / 2) + "px";
    });

    // ── Arrival: pulse ring ─────────────────────────────────────────
    setTimeout(() => {
      // Spawn expanding ring at destination.
      const ring = document.createElement("div");
      ring.className = POINTER_CLASS;
      const half = PULSE_RING_SIZE / 2;
      Object.assign(ring.style, {
        position: "fixed",
        zIndex: "9998",
        pointerEvents: "none",
        left: (endX - half) + "px",
        top: (endY - half) + "px",
        width: PULSE_RING_SIZE + "px",
        height: PULSE_RING_SIZE + "px",
        borderRadius: "50%",
        border: "2px solid rgba(140,210,255,0.7)",
        boxShadow: "0 0 10px 2px rgba(120,200,255,0.3)",
        opacity: "1",
        transform: "scale(0.4)",
        transition: `transform ${PULSE_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${PULSE_DURATION_MS}ms ease`,
      });
      document.body.appendChild(ring);

      requestAnimationFrame(() => {
        ring.style.transform = "scale(1.2)";
        ring.style.opacity = "0";
      });

      // Fade the orb out.
      setTimeout(() => {
        orb.style.opacity = "0";
      }, PULSE_DURATION_MS * 0.3);

      // Clean up both elements.
      setTimeout(() => {
        orb.remove();
        ring.remove();
      }, PULSE_DURATION_MS + FADE_DURATION_MS);

    }, FLY_DURATION_MS);
  }

  return { flyTo, cleanup: _cleanup };
}
