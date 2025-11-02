// display/input/InputManager.js
// Collects DOM input from a target element/window and emits normalized actions.
// This module is display-only and must not import rules.

import { Actions, makeAction } from "./actions.js";

const TAP_MS = 260; // max duration for a tap
const SWIPE_MIN_PX = 40; // min distance to qualify as a swipe

export class InputManager {
  constructor(targetEl, options = {}) {
    this.target = targetEl || window;
    this.handlers = new Set();
    this.hotspots = new Map(); // id -> { element, action }
  this._pointer = null; // { id, x0,y0,t0, lastX,lastY }
  this._multi = new Map(); // pointerId -> { x,y }
  this._pinch = null; // { id1,id2, d0 }
    this._canvas = options.canvas || null;

    this._onKeyDown = (e) => this._handleKeyDown(e);
    this._onPointerDown = (e) => this._handlePointerDown(e);
    this._onPointerMove = (e) => this._handlePointerMove(e);
    this._onPointerUp = (e) => this._handlePointerUp(e);

    this._bind();
  }

  dispose() {
    this._unbind();
    this.handlers.clear();
    this.hotspots.clear();
  }

  onAction(handler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  registerHotspot(id, element, action) {
    if (!element) return () => {};
    const rec = { element, action };
    this.hotspots.set(id, rec);
    const click = (ev) => {
      ev.preventDefault();
      this._emit(action);
    };
    element.addEventListener("click", click, { passive: false });
    return () => {
      element.removeEventListener("click", click);
      this.hotspots.delete(id);
    };
  }

  _emit(action) {
    for (const h of this.handlers) try { h(action); } catch {}
  }

  _bind() {
    this.target.addEventListener("keydown", this._onKeyDown);
    const el = this._canvas || this.target;
    el.addEventListener("pointerdown", this._onPointerDown, { passive: true });
    el.addEventListener("pointermove", this._onPointerMove, { passive: true });
    el.addEventListener("pointerup", this._onPointerUp, { passive: true });
    el.addEventListener("pointercancel", this._onPointerUp, { passive: true });
  }

  _unbind() {
    this.target.removeEventListener("keydown", this._onKeyDown);
    const el = this._canvas || this.target;
    el.removeEventListener("pointerdown", this._onPointerDown);
    el.removeEventListener("pointermove", this._onPointerMove);
    el.removeEventListener("pointerup", this._onPointerUp);
    el.removeEventListener("pointercancel", this._onPointerUp);
  }

  _handleKeyDown(e) {
    const { key, code } = e;
    // Wait intent: '.' (period)
    if (key === ".") {
      e.preventDefault();
      this._emit(makeAction(Actions.Wait));
      return;
    }
    // Move left / right
    if (code === "ArrowLeft" || key === "a" || key === "h") {
      e.preventDefault();
      this._emit(makeAction(Actions.Move, { dx: -1, dy: 0 }));
      return;
    }
    if (code === "ArrowRight" || key === "d" || key === "l") {
      e.preventDefault();
      this._emit(makeAction(Actions.Move, { dx: 1, dy: 0 }));
      return;
    }
    // Move up / down
    if (code === "ArrowUp" || key === "w" || key === "k") {
      e.preventDefault();
      this._emit(makeAction(Actions.Move, { dx: 0, dy: -1 }));
      return;
    }
    if (code === "ArrowDown" || key === "s" || key === "j") {
      e.preventDefault();
      this._emit(makeAction(Actions.Move, { dx: 0, dy: 1 }));
      return;
    }
    // Drink potion (common roguelike: 'q' for quaff)
    if (key?.toLowerCase() === "q") {
      e.preventDefault();
      this._emit(makeAction(Actions.DrinkPotion));
      return;
    }
  }

  _handlePointerDown(e) {
    const rect = (this._canvas || this.target).getBoundingClientRect?.() || { left: 0, top: 0 };
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Track in multi map
    this._multi.set(e.pointerId, { x, y });

    if (this._multi.size === 2) {
      // Enter pinch mode
      const ids = Array.from(this._multi.keys());
      const a = this._multi.get(ids[0]);
      const b = this._multi.get(ids[1]);
      const d0 = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      this._pinch = { id1: ids[0], id2: ids[1], d0 };
      this._pointer = null; // cancel single-pointer tap/drag
      return;
    }

    if (!this._pointer && this._multi.size === 1) {
      this._pointer = { id: e.pointerId, x0: x, y0: y, t0: performance.now(), lastX: x, lastY: y };
    }
  }

  _handlePointerMove(e) {
    const rect = (this._canvas || this.target).getBoundingClientRect?.() || { left: 0, top: 0 };
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (this._multi.has(e.pointerId)) this._multi.set(e.pointerId, { x, y });

    if (this._pinch) {
      const a = this._multi.get(this._pinch.id1);
      const b = this._multi.get(this._pinch.id2);
      if (!a || !b) return;
      const d = Math.hypot(b.x - a.x, b.y - a.y) || this._pinch.d0;
      const factor = d / (this._pinch.d0 || 1);
      // Emit zoom deltas around 1.0 (avoid huge jumps)
      if (Number.isFinite(factor) && factor > 0) {
        this._emit(makeAction(Actions.Zoom, { factor }));
        // Update baseline to allow smooth continuous pinch
        this._pinch.d0 = d;
      }
      return;
    }

    const p = this._pointer;
    if (!p || p.id !== e.pointerId) return;
    p.lastX = x; p.lastY = y;
  }

  _handlePointerUp(e) {
    // Update multi map
    this._multi.delete(e.pointerId);

    // End pinch if one of the fingers lifted
    if (this._pinch && (e.pointerId === this._pinch.id1 || e.pointerId === this._pinch.id2)) {
      this._pinch = null;
    }

    // Handle single-pointer tap/swipe
    const p = this._pointer;
    if (!p || p.id !== e.pointerId) { return; }
    this._pointer = null;

    const rect = (this._canvas || this.target).getBoundingClientRect?.();
    const width = rect?.width || (this._canvas?.width ?? window.innerWidth);
    const height = rect?.height || (this._canvas?.height ?? window.innerHeight);

    const dt = performance.now() - p.t0;
    const dx = (p.lastX - p.x0);
    const dy = (p.lastY - p.y0);
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    // Swipe gestures
    if (Math.max(adx, ady) >= SWIPE_MIN_PX) {
      if (adx >= ady) {
        if (dx > 0) this._emit(makeAction(Actions.OpenInventory));
        // could add swipe-left for other menus later
      } else {
        if (dy > 0) this._emit(makeAction(Actions.OpenMessageLog));
      }
      return;
    }

    // Tap: short press without large movement
    if (dt <= TAP_MS) {
      const leftHalf = p.x0 < width * 0.5;
      // If active-spell hotspot exists and tap is on it, prefer casting
      const activeSpellEl = document.getElementById?.("active-spell");
      if (activeSpellEl) {
        const r = activeSpellEl.getBoundingClientRect();
        // Convert pointer to viewport coords for this check
        const vx = (this._canvas ? p.x0 + rect.left : p.x0);
        const vy = (this._canvas ? p.y0 + rect.top : p.y0);
        if (vx >= r.left && vx <= r.right && vy >= r.top && vy <= r.bottom) {
          this._emit(makeAction(Actions.CastActiveSpell));
          return;
        }
      }

      // Otherwise, left/right tap → move
      if (leftHalf) this._emit(makeAction(Actions.Move, { dx: -1, dy: 0 }));
      else this._emit(makeAction(Actions.Move, { dx: 1, dy: 0 }));
    }
  }
}
