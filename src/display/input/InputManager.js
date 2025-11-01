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
    // Drink potion (common roguelike: 'q' for quaff)
    if (key?.toLowerCase() === "q") {
      e.preventDefault();
      this._emit(makeAction(Actions.DrinkPotion));
      return;
    }
  }

  _handlePointerDown(e) {
    if (this._pointer) return; // single-pointer gestures only
    const rect = (this._canvas || this.target).getBoundingClientRect?.() || { left: 0, top: 0 };
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this._pointer = { id: e.pointerId, x0: x, y0: y, t0: performance.now(), lastX: x, lastY: y };
  }

  _handlePointerMove(e) {
    const p = this._pointer;
    if (!p || p.id !== e.pointerId) return;
    const rect = (this._canvas || this.target).getBoundingClientRect?.() || { left: 0, top: 0 };
    p.lastX = e.clientX - rect.left;
    p.lastY = e.clientY - rect.top;
  }

  _handlePointerUp(e) {
    const p = this._pointer;
    if (!p || p.id !== e.pointerId) return;
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
