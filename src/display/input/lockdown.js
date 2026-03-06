// display/input/lockdown.js
// Global input + scroll lockdown for kiosk-style control. Display-only.
// Prevents browser scrolling, zooming, text selection, context menu, and drag.

/**
 * Enable strict input lockdown to let the app own all gestures (incl. pinch).
 * Notes:
 * - Cannot truly prevent all DevTools shortcuts across browsers, but we block
 *   common ones to reduce accidents.
 * - Uses capture listeners with passive:false where needed so preventDefault()
 *   actually takes effect.
 * @param {Object} opts
 * @param {HTMLCanvasElement|null} opts.canvas - main interactive surface
 */
export function enableInputLockdown({ canvas = null } = {}) {
  try {
    /**
     * Allow native scroll behavior for designated UI containers.
     * @param {EventTarget | null} target
     */
    const shouldAllowNativeScroll = (target) => {
      let el = target instanceof Element ? target : null;
      while (el) {
        const attr = el.getAttribute?.("data-allow-scroll");
        if (attr === "true" || attr === "1") return true;
        const style = window.getComputedStyle(el);
        const oy = String(style.overflowY || style.overflow || "");
        const ox = String(style.overflowX || style.overflow || "");
        const canY = (oy === "auto" || oy === "scroll" || oy === "overlay")
          && (el.scrollHeight > (el.clientHeight + 1));
        const canX = (ox === "auto" || ox === "scroll" || ox === "overlay")
          && (el.scrollWidth > (el.clientWidth + 1));
        if (canY || canX) return true;
        el = el.parentElement;
      }
      return false;
    };

    // CSS fallbacks in case index.html styles are altered later
    const root = document.documentElement;
    const body = document.body;
    if (root && body) {
      Object.assign(root.style, {
        overscrollBehavior: "none",
        overflow: "hidden",
        touchAction: "none",
        userSelect: "none",
      });
      Object.assign(body.style, {
        overscrollBehavior: "none",
        overflow: "hidden",
        touchAction: "none",
        userSelect: "none",
      });
    }

    const target = canvas || window;

    // Helper: safe add
    const on = (el, type, fn, opts) => el && el.addEventListener(type, fn, opts);

    // 1) Wheel scrolling and ctrl+wheel zoom
    on(window, "wheel", (e) => {
      if (shouldAllowNativeScroll(e.target)) return;
      // Block any default scrolling/zooming behavior
      e.preventDefault();
    }, { passive: false, capture: true });

    // 2) Touch/pointer-based scrolling and pinch-zoom
    // iOS Safari extra gesture events
    for (const t of ["gesturestart", "gesturechange", "gestureend"]) {
      on(window, t, (e) => { e.preventDefault(); }, { passive: false, capture: true });
    }
    on(window, "touchmove", (e) => {
      if (shouldAllowNativeScroll(e.target)) return;
      e.preventDefault();
    }, { passive: false, capture: true });

    // 3) Keyboard-based scrolling and browser zoom shortcuts
    const scrollKeys = new Set([
      "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
      "PageUp", "PageDown", "Home", "End", "Space",
    ]);

    on(window, "keydown", (e) => {
      // Never block keys when the user is typing in a text field (e.g. debug console)
      const tag = String(/** @type {any} */ (e.target)?.tagName || "").toLowerCase();
      const isText = tag === "input" || tag === "textarea" || !!/** @type {any} */ (e.target)?.isContentEditable;
      if (isText) return;

      // Block zoom combos
      const k = e.key;
      if ((e.ctrlKey || e.metaKey) && (k === "+" || k === "=" || k === "-" || k === "_" || k === "0")) {
        e.preventDefault();
        return;
      }
      // Block common devtools combinations (best-effort)
      if ((e.ctrlKey && e.shiftKey && (k === "I" || k === "i" || k === "J" || k === "j" || k === "C" || k === "c")) || k === "F12") {
        e.preventDefault();
        return;
      }
      // Block keys that scroll the page
      if (scrollKeys.has(e.code) || scrollKeys.has(k)) {
        e.preventDefault();
        return;
      }
    }, { capture: true });

    // 4) Context menu, selection, and drag
    for (const t of ["contextmenu", "dragstart", "selectstart"]) {
      const handler = (e) => {
        // Allow text selection inside text fields (e.g. debug console input)
        if (t === "selectstart") {
          const tag = String(/** @type {any} */ (e.target)?.tagName || "").toLowerCase();
          if (tag === "input" || tag === "textarea" || !!/** @type {any} */ (e.target)?.isContentEditable) return;
        }
        e.preventDefault();
      };
      on(window, t, handler, { capture: true });
      on(document, t, handler, { capture: true });
    }

    // 5) Pointer capture on the canvas keeps interactions owned by app
    if (canvas) {
      on(canvas, "pointerdown", (e) => {
        try { canvas.setPointerCapture?.(e.pointerId); } catch {} // pointer capture may not be supported
        // Prevent any default like text selection or image drag
        e.preventDefault();
      }, { passive: false, capture: true });

      // Prevent double-tap zoom on iOS via dblclick as a belt-and-suspenders
      on(canvas, "dblclick", (e) => { e.preventDefault(); }, { capture: true });
    }

    // 6) Keep page fixed at top-left just in case
    window.scrollTo(0, 0);
    on(window, "scroll", () => { if (window.scrollX || window.scrollY) window.scrollTo(0, 0); }, { capture: true });
  } catch (err) {
    console?.warn?.("Input lockdown setup failed:", err);
  }
}
