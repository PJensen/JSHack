// display/input/InputManager.js
// ULTRA BASIC touch controls - no fancy gestures, just simple taps
// This module is display-only and must not import rules.

import { Actions, makeAction } from "./actions.js";
import { screenToWorld } from "../camera/controller.js";

export class InputManager {
  constructor(targetEl, options = {}) {
    this.target = targetEl || window;
    this.handlers = new Set();
    this.hotspots = new Map(); // id -> { element, action }
    this._canvas = options.canvas || null;
    this._camera = options.camera || null;
    this._getPointerOrigin = typeof options.getPointerOrigin === "function"
      ? options.getPointerOrigin
      : null;

    this._onKeyDown = (e) => this._handleKeyDown(e);
    this._onPointerDown = (e) => this._handlePointerDown(e);

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
    if (!element) return () => { };
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
    for (const h of this.handlers) try { h(action); } catch { }
  }

  _bind() {
    this.target.addEventListener("keydown", this._onKeyDown);
    const el = this._canvas || this.target;
    el.addEventListener("pointerdown", this._onPointerDown, { passive: false });
  }

  _unbind() {
    this.target.removeEventListener("keydown", this._onKeyDown);
    const el = this._canvas || this.target;
    el.removeEventListener("pointerdown", this._onPointerDown);
  }

  _handleKeyDown(e) {
    const { key, code } = e;
    // If any UI panel is open, ignore movement/consumable bindings to let UI handle keys
    try {
      const openPanels = Array.from(document.querySelectorAll('.ui-panel')).filter(p => p && p.style.display === 'block');
      if (openPanels.length) {
        // Allow UI overlays to consume keys like arrows/enter without moving the player
        return;
      }
    } catch {}

    // Open Inventory: 'i'
    if (key?.toLowerCase() === 'i') {
      e.preventDefault();
      this._emit(makeAction(Actions.OpenInventory));
      return;
    }
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

    // Pickup chooser (',' for get)
    if (key === ",") {
      e.preventDefault();
      // Open chooser in display; chooser will submit specific items to rules
      this._emit(makeAction(Actions.OpenPickupChooser));
      return;
    }
  }

  _handlePointerDown(e) {
    e.preventDefault();
    
    // Get canvas dimensions
    const canvas = this._canvas;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width ? (canvas.width / rect.width) : 1;
    const scaleY = rect.height ? (canvas.height / rect.height) : 1;
    const sx = (e.clientX - rect.left) * scaleX;
    const sy = (e.clientY - rect.top) * scaleY;

    let wx = null;
    let wy = null;

    if (this._camera) {
      const worldPos = screenToWorld(this._camera, sx, sy, canvas);
      wx = worldPos[0];
      wy = worldPos[1];
    }

    let origin = null;
    if (this._getPointerOrigin) {
      try {
        origin = this._getPointerOrigin() || null;
      } catch {
        origin = null;
      }
    }

    if (!origin && this._camera) {
      origin = { x: this._camera.x || 0, y: this._camera.y || 0 };
    }

    if (!origin) {
      // Fallback: assume center of the canvas represents the actor.
      const centerX = canvas.width * 0.5;
      const centerY = canvas.height * 0.5;
      const dx = (sx - centerX);
      const dy = (sy - centerY);
      if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) return;
      this._emit(makeAction(Actions.Move, { dx, dy }));
      return;
    }

    if (wx === null || wy === null) {
      // Without camera conversion, fall back to canvas space relative vector.
      const centerX = canvas.width * 0.5;
      const centerY = canvas.height * 0.5;
      const dx = (sx - centerX);
      const dy = (sy - centerY);
      if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) return;
      this._emit(makeAction(Actions.Move, { dx, dy }));
      return;
    }

    const dx = wx - origin.x;
    const dy = wy - origin.y;
    if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4) return;

    this._emit(makeAction(Actions.Move, { dx, dy }));
  }
}
