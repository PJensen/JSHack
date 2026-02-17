// display/input/InputManager.js
// ULTRA BASIC touch controls - no fancy gestures, just simple taps
// This module is display-only and must not import rules.

import { Actions, makeAction } from "./actions.js";

export class InputManager {
  constructor(targetEl, options = {}) {
    this.target = targetEl || window;
    this.handlers = new Set();
    this.hotspots = new Map(); // id -> { element, action }
    this._canvas = options.canvas || null;

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
    // Pray to deity: 'P' (Shift+P)
    if (key === "P") {
      e.preventDefault();
      this._emit(makeAction(Actions.Pray));
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

    // Cast active spell: 'f'
    if (key?.toLowerCase() === "f") {
      e.preventDefault();
      this._emit(makeAction(Actions.CastActiveSpell));
      return;
    }

    // Ranged attack: 'r'
    if (key?.toLowerCase() === "r") {
      e.preventDefault();
      this._emit(makeAction(Actions.ShootRanged));
      return;
    }

    // Pet state rotation: 'p'
    if (key?.toLowerCase() === "p") {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('ui:rotatePetState'));
      return;
    }

    // Memory graph toggle: '8'
    if (key === '8') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('ui:toggleMemoryGraph'));
      return;
    }

    // Apply tool: 'A' (Shift+A)
    if (key === "A") {
      e.preventDefault();
      this._emit(makeAction(Actions.OpenApplyChooser));
      return;
    }

    // Death log: '#' (tombstone-themed)
    if (key === "#") {
      e.preventDefault();
      this._emit(makeAction(Actions.OpenDeathLog));
      return;
    }

    // Pickup chooser: ',' (get)
    if (key === ",") {
      e.preventDefault();
      this._emit(makeAction(Actions.OpenPickupChooser));
      return;
    }
    // Desktop stair traverse: Enter / NumpadEnter
    if (key === "Enter" || code === "NumpadEnter") {
      e.preventDefault();
      this._emit(makeAction(Actions.TraverseStairs));
      return;
    }
  }

  _handlePointerDown(e) {
    e.preventDefault();
    
    // Get canvas dimensions
    const canvas = this._canvas;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Convert to canvas center coordinates
    const centerX = rect.width * 0.5;
    const centerY = rect.height * 0.5;
    
    const dx = x - centerX;
    const dy = y - centerY;
    
    // Determine direction based on which quadrant/region was tapped
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal movement
      if (dx > 0) {
        this._emit(makeAction(Actions.Move, { dx: 1, dy: 0 })); // Right
      } else {
        this._emit(makeAction(Actions.Move, { dx: -1, dy: 0 })); // Left
      }
    } else {
      // Vertical movement
      if (dy > 0) {
        this._emit(makeAction(Actions.Move, { dx: 0, dy: 1 })); // Down
      } else {
        this._emit(makeAction(Actions.Move, { dx: 0, dy: -1 })); // Up
      }
    }
  }
}
