// display/input/InputManager.js
// Mobile-first pointer controls with spell gesture recognition.
// This module is display-only and must not import rules.

import {
  recognizeBlastwaveGesture,
  recognizeLightningGesture,
  recognizeMeteorGesture,
} from "./gestureRecognizers.js";
import { Actions, makeAction } from "./actions.js";

const TAP_SLOP_PX = 14;
const SAMPLE_MIN_DIST_PX = 3;
const MAX_GESTURE_POINTS = 64;
const MIN_GESTURE_POINTS = 6;
const CAST_MIN_QUALITY = 0.42;
const GESTURE_CLEAR_DELAY_MS = 180;

export class InputManager {
  constructor(targetEl, options = {}) {
    this.target = targetEl || window;
    this.handlers = new Set();
    this.hotspots = new Map(); // id -> { element, action }
    this._canvas = options.canvas || null;
    this._touchFeedback = options.touchFeedback !== false;
    this._gestureClearTimer = 0;
    this._gesture = {
      active: false,
      pointerId: -1,
      pointerType: "",
      rect: null,
      localPoints: [],
      viewPoints: [],
      moved: false,
    };

    this._onKeyDown = (e) => this._handleKeyDown(e);
    this._onPointerDown = (e) => this._handlePointerDown(e);
    this._onPointerMove = (e) => this._handlePointerMove(e);
    this._onPointerUp = (e) => this._handlePointerUp(e);
    this._onPointerCancel = (e) => this._handlePointerCancel(e);

    this._bind();
  }

  dispose() {
    this._unbind();
    if (this._gestureClearTimer) {
      clearTimeout(this._gestureClearTimer);
      this._gestureClearTimer = 0;
    }
    this._resetGestureState();
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
    for (const h of this.handlers) try { h(action); } catch (e) { console.debug('[InputManager] handler failed:', e); }
  }

  _bind() {
    this.target.addEventListener("keydown", this._onKeyDown);
    const el = this._canvas || this.target;
    el.addEventListener("pointerdown", this._onPointerDown, { passive: false });
    el.addEventListener("pointermove", this._onPointerMove, { passive: false });
    el.addEventListener("pointerup", this._onPointerUp, { passive: false });
    el.addEventListener("pointercancel", this._onPointerCancel, { passive: false });
  }

  _unbind() {
    this.target.removeEventListener("keydown", this._onKeyDown);
    const el = this._canvas || this.target;
    el.removeEventListener("pointerdown", this._onPointerDown);
    el.removeEventListener("pointermove", this._onPointerMove);
    el.removeEventListener("pointerup", this._onPointerUp);
    el.removeEventListener("pointercancel", this._onPointerCancel);
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
    } catch (e) { console.debug('[InputManager] panel query failed:', e); }

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

    // Ranged attack / zap: 'r' or 'z'
    if (key?.toLowerCase() === "r" || key?.toLowerCase() === "z") {
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
    const canvas = this._canvas;
    if (!canvas) return;
    if (e.pointerType === "mouse") {
      if (e.button !== 0) return;
      e.preventDefault();
      this._emitMoveTap(e.clientX, e.clientY, canvas.getBoundingClientRect());
      return;
    }
    if (this._gesture.active) return;
    if (typeof e.isPrimary === "boolean" && !e.isPrimary) return;

    e.preventDefault();
    if (this._gestureClearTimer) {
      clearTimeout(this._gestureClearTimer);
      this._gestureClearTimer = 0;
    }
    this._gesture.active = true;
    this._gesture.pointerId = Number(e.pointerId);
    this._gesture.pointerType = String(e.pointerType || "");
    this._gesture.rect = canvas.getBoundingClientRect();
    this._gesture.localPoints = [];
    this._gesture.viewPoints = [];
    this._gesture.moved = false;
    this._appendGesturePoint(e);
    this._emitGestureProgress(true, null);
    try {
      if (typeof canvas.setPointerCapture === "function") canvas.setPointerCapture(e.pointerId);
    } catch {} // pointer capture may not be supported
  }

  _handlePointerMove(e) {
    if (!this._gesture.active) return;
    if (Number(e.pointerId) !== this._gesture.pointerId) return;

    e.preventDefault();
    this._appendGesturePoint(e);
    this._emitGestureProgress(true, null);
  }

  _handlePointerUp(e) {
    if (!this._gesture.active) return;
    if (Number(e.pointerId) !== this._gesture.pointerId) return;

    e.preventDefault();
    this._appendGesturePoint(e);

    let recognized = null;
    if (this._gesture.moved && this._gesture.localPoints.length >= MIN_GESTURE_POINTS) {
      recognized = this._recognizeSpellGesture(this._gesture.localPoints, CAST_MIN_QUALITY);
    }

    if (recognized?.spellId) {
      this._emit(makeAction(Actions.CastActiveSpell, { spellId: recognized.spellId }));
      this._emitUi("ui:showSpellGestureHint", {
        id: recognized.spellId,
        mode: "cast",
        quality: recognized.quality,
      });
      this._emitGestureProgress(false, recognized);
      this._resetGestureState();
      this._gestureClearTimer = setTimeout(() => {
        this._emitUi("ui:gestureProgress", { points: [], active: false, recognized: null });
        this._gestureClearTimer = 0;
      }, GESTURE_CLEAR_DELAY_MS);
      return;
    }

    const last = this._gesture.localPoints[this._gesture.localPoints.length - 1];
    if (last) this._emitMoveFromLocalPoint(last, this._gesture.rect);
    this._emitUi("ui:gestureProgress", { points: [], active: false, recognized: null });
    this._resetGestureState();
  }

  _handlePointerCancel(e) {
    if (!this._gesture.active) return;
    if (Number(e.pointerId) !== this._gesture.pointerId) return;
    e.preventDefault();
    this._emitUi("ui:gestureProgress", { points: [], active: false, recognized: null });
    this._resetGestureState();
  }

  _resetGestureState() {
    const canvas = this._canvas;
    const pointerId = this._gesture.pointerId;
    this._gesture.active = false;
    this._gesture.pointerId = -1;
    this._gesture.pointerType = "";
    this._gesture.rect = null;
    this._gesture.localPoints = [];
    this._gesture.viewPoints = [];
    this._gesture.moved = false;
    try {
      if (canvas && pointerId >= 0 && typeof canvas.releasePointerCapture === "function") {
        canvas.releasePointerCapture(pointerId);
      }
    } catch {} // pointer capture may not be supported
  }

  _appendGesturePoint(e) {
    const rect = this._gesture.rect || this._canvas?.getBoundingClientRect();
    if (!rect) return;
    const localX = Number(e.clientX) - rect.left;
    const localY = Number(e.clientY) - rect.top;
    const viewX = Number(e.clientX);
    const viewY = Number(e.clientY);
    if (!Number.isFinite(localX) || !Number.isFinite(localY)) return;
    if (!Number.isFinite(viewX) || !Number.isFinite(viewY)) return;

    const points = this._gesture.localPoints;
    const last = points[points.length - 1];
    if (last) {
      const d = Math.hypot(localX - last.x, localY - last.y);
      if (d < SAMPLE_MIN_DIST_PX) return;
    }
    points.push({ x: localX, y: localY });
    this._gesture.viewPoints.push({ x: viewX, y: viewY });
    if (points.length > MAX_GESTURE_POINTS) {
      points.shift();
      this._gesture.viewPoints.shift();
    }

    const first = points[0];
    if (!first) return;
    const distFromStart = Math.hypot(localX - first.x, localY - first.y);
    this._gesture.moved = this._gesture.moved || distFromStart >= TAP_SLOP_PX;
  }

  _emitGestureProgress(active, recognized) {
    if (!this._touchFeedback) return;
    this._emitUi("ui:gestureProgress", {
      points: this._gesture.viewPoints.slice(),
      active: !!active,
      recognized: recognized || null,
    });
  }

  _recognizeSpellGesture(localPoints, minQuality) {
    if (!Array.isArray(localPoints) || localPoints.length < MIN_GESTURE_POINTS) return null;
    const z = recognizeLightningGesture(localPoints);
    const slash = recognizeMeteorGesture(localPoints);
    const circle = recognizeBlastwaveGesture(localPoints);
    const candidates = [];
    if (z && Number(z.quality) >= minQuality) {
      candidates.push({
        spellId: "lightning",
        quality: Number(z.quality),
        bounds: this._boundsToViewport(z.bounds),
      });
    }
    if (slash && Number(slash.quality) >= minQuality) {
      candidates.push({
        spellId: "meteor",
        quality: Number(slash.quality),
        bounds: this._boundsToViewport(slash.bounds),
      });
    }
    if (circle && Number(circle.quality) >= minQuality) {
      candidates.push({
        spellId: "blastwave",
        quality: Number(circle.quality),
        bounds: this._boundsToViewport(circle.bounds),
      });
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => b.quality - a.quality);
    return candidates[0];
  }

  _boundsToViewport(bounds) {
    const rect = this._gesture.rect;
    if (!bounds || !rect) return null;
    return {
      x: rect.left + Number(bounds.minX || 0),
      y: rect.top + Number(bounds.minY || 0),
      w: Number(bounds.width || 0),
      h: Number(bounds.height || 0),
    };
  }

  _emitMoveTap(clientX, clientY, rect) {
    const x = Number(clientX) - rect.left;
    const y = Number(clientY) - rect.top;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this._emitMoveFromLocalPoint({ x, y }, rect);
  }

  _emitMoveFromLocalPoint(point, rect) {
    if (!point || !rect) return;
    const centerX = rect.width * 0.5;
    const centerY = rect.height * 0.5;
    const dx = point.x - centerX;
    const dy = point.y - centerY;
    if (Math.abs(dx) > Math.abs(dy)) {
      this._emit(makeAction(Actions.Move, { dx: dx > 0 ? 1 : -1, dy: 0 }));
      return;
    }
    this._emit(makeAction(Actions.Move, { dx: 0, dy: dy > 0 ? 1 : -1 }));
  }

  _emitUi(name, detail) {
    try {
      this.target?.dispatchEvent?.(new CustomEvent(name, { detail }));
    } catch (e) { console.debug('[InputManager] dispatch ' + name + ':', e); }
  }
}
