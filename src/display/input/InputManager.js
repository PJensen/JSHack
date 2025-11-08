// display/input/InputManager.js
// ULTRA BASIC touch controls - no fancy gestures, just simple taps
// This module is display-only and must not import rules.

import { Actions, makeAction } from "./actions.js";
import { screenToWorld } from "../camera/controller.js";
import { recognizeLightningGesture, recognizeMeteorGesture } from "./gestureRecognizers.js";

const GESTURE_HOLD_MS = 180;
const GESTURE_DRAG_THRESHOLD = 26;
const GESTURE_DRAG_THRESHOLD_SQ = GESTURE_DRAG_THRESHOLD * GESTURE_DRAG_THRESHOLD;

export class InputManager {
  constructor(targetEl, options = {}) {
    this.target = targetEl || window;
    this.handlers = new Set();
    this.hotspots = new Map(); // id -> { element, action }
    this._canvas = options.canvas || null;
    this._camera = options.camera || null;
    this._gesturePointerId = null;
    this._gesturePointerType = "";
    this._gestureCaptureEl = null;
    this._gesturePoints = [];
    this._gestureWorldPoints = [];
    this._gestureClientPoints = [];
    this._gestureStartTime = 0;
    this._gestureDownTime = 0;
    this._gestureActive = false;
    this._gestureHoldTimer = 0;
    this._getPointerOrigin = typeof options.getPointerOrigin === "function"
      ? options.getPointerOrigin
      : null;

    this._onKeyDown = (e) => this._handleKeyDown(e);
    this._onPointerDown = (e) => this._handlePointerDown(e);
    this._onPointerMove = (e) => this._handlePointerMove(e);
    this._onPointerUp = (e) => this._handlePointerUp(e);
    this._onPointerCancel = (e) => this._handlePointerCancel(e);

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
    const keyLower = typeof key === "string" ? key.toLowerCase() : "";
    // If any UI panel is open, ignore movement/consumable bindings to let UI handle keys
    try {
      const openPanels = Array.from(document.querySelectorAll('.ui-panel')).filter(p => p && p.style.display === 'block');
      if (openPanels.length) {
        // Allow UI overlays to consume keys like arrows/enter without moving the player
        return;
      }
    } catch {}

    // Open Inventory: 'i'
    if (keyLower === 'i') {
      e.preventDefault();
      this._emit(makeAction(Actions.OpenInventory));
      return;
    }
    // Wait intent: '.' (period)
    if (key === "." || code === "Numpad5") {
      e.preventDefault();
      this._emit(makeAction(Actions.Wait));
      return;
    }
    // Diagonal movement (numpad-style)
    if (code === "Home" || code === "Numpad7" || keyLower === "y") {
      e.preventDefault();
      this._emit(makeAction(Actions.Move, { dx: -1, dy: -1 }));
      return;
    }
    if (code === "PageUp" || code === "Numpad9" || keyLower === "u") {
      e.preventDefault();
      this._emit(makeAction(Actions.Move, { dx: 1, dy: -1 }));
      return;
    }
    if (code === "End" || code === "Numpad1" || keyLower === "b") {
      e.preventDefault();
      this._emit(makeAction(Actions.Move, { dx: -1, dy: 1 }));
      return;
    }
    if (code === "PageDown" || code === "Numpad3" || keyLower === "n") {
      e.preventDefault();
      this._emit(makeAction(Actions.Move, { dx: 1, dy: 1 }));
      return;
    }
    // Move left / right
    if (code === "ArrowLeft" || code === "Numpad4" || keyLower === "a" || keyLower === "h") {
      e.preventDefault();
      this._emit(makeAction(Actions.Move, { dx: -1, dy: 0 }));
      return;
    }
    if (code === "ArrowRight" || code === "Numpad6" || keyLower === "d" || keyLower === "l") {
      e.preventDefault();
      this._emit(makeAction(Actions.Move, { dx: 1, dy: 0 }));
      return;
    }
    // Move up / down
    if (code === "ArrowUp" || code === "Numpad8" || keyLower === "w" || keyLower === "k") {
      e.preventDefault();
      this._emit(makeAction(Actions.Move, { dx: 0, dy: -1 }));
      return;
    }
    if (code === "ArrowDown" || code === "Numpad2" || keyLower === "s" || keyLower === "j") {
      e.preventDefault();
      this._emit(makeAction(Actions.Move, { dx: 0, dy: 1 }));
      return;
    }
    // Drink potion (common roguelike: 'q' for quaff)
    if (keyLower === "q") {
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

    const canvas = this._canvas;
    if (!canvas) return;

    const pointer = this._computePointerPosition(e);
    if (!pointer) return;

    this._beginGesture(e, pointer);
    // Do not emit Move on pointer down. We defer deciding between
    // a movement tap vs. spell gesture until pointerup.
  }

  _handlePointerMove(e) {
    if (this._gesturePointerId === null || e.pointerId !== this._gesturePointerId) return;
    if (!this._canvas) return;
    const pointer = this._computePointerPosition(e);
    if (!pointer) return;
    this._accumulateGesturePoint(pointer);
    if (!this._gestureActive && this._shouldActivateGesture(pointer)) {
      this._activateGesture();
    }
  }

  _handlePointerUp(e) {
    if (this._gesturePointerId === null || e.pointerId !== this._gesturePointerId) return;
    if (!this._canvas) return;
    const pointer = this._computePointerPosition(e);
    if (pointer) {
      this._accumulateGesturePoint(pointer);
    }

    // If a long-press/drag activated gesture mode, finalize to run recognizer.
    if (this._gestureActive) {
      this._finalizeGesture();
      return;
    }

    // Fallback: if the stroke looks like a gesture even without explicit activation,
    // try recognition before treating it as a tap move.
    try {
      const now = performance?.now ? performance.now() : Date.now();
      const start = this._gestureDownTime || now;
      const duration = (now - start) / 1000;
      if (duration >= 0.08 && this._gesturePoints && this._gesturePoints.length >= 4) {
        // Try meteor (diagonal) first; then lightning "Z".
        let recognized = null;
        let recognizedId = null;
        const mres = recognizeMeteorGesture(this._gesturePoints);
        if (mres) { recognized = mres; recognizedId = 'meteor'; }
        else {
          const lres = recognizeLightningGesture(this._gesturePoints);
          if (lres) { recognized = lres; recognizedId = 'lightning'; }
        }
        if (recognized && recognizedId) {
          const detail = {
            id: recognizedId,
            duration,
            pointerType: this._gesturePointerType,
            quality: recognized.quality,
            bounds: recognized.bounds,
            normalizedPath: recognized.normalizedPath,
            worldPath: this._gestureWorldPoints.length ? this._gestureWorldPoints.slice() : null,
          };
          // Debug overlay notify
          try {
            const rect = this._lastRect || this._canvas?.getBoundingClientRect?.() || null;
            const sx = this._lastScaleX || 1;
            const sy = this._lastScaleY || 1;
            const b = recognized.bounds;
            const screenBounds = rect ? { x: rect.left + b.minX / (sx || 1), y: rect.top + b.minY / (sy || 1), w: b.width / (sx || 1), h: b.height / (sy || 1) } : null;
            window.dispatchEvent(new CustomEvent("ui:gestureProgress", { detail: { points: this._gestureClientPoints?.slice?.() || [], active: true, recognized: { id: recognizedId, quality: recognized.quality, bounds: screenBounds }, phase: 'recognized' } }));
          } catch {}
          try { window.dispatchEvent(new CustomEvent("input:spellGesture", { detail })); } catch {}
          this._finalizeGesture();
          return;
        }
      }
    } catch {}

    // Otherwise treat as a short tap.
    if (pointer) {
      // Emit world-tap with world coords; display handler decides whether to shoot or move
      const payload = { x: (pointer.wx ?? null), y: (pointer.wy ?? null), sx: pointer.sx, sy: pointer.sy };
      this._emit(makeAction(Actions.TapWorld, payload));
    }

    this._finalizeGesture(true);
  }

  _handlePointerCancel(e) {
    if (this._gesturePointerId === null || e.pointerId !== this._gesturePointerId) return;
    this._finalizeGesture(true);
  }

  _computePointerPosition(e) {
    const canvas = this._canvas;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width ? (canvas.width / rect.width) : 1;
    const scaleY = rect.height ? (canvas.height / rect.height) : 1;
    const sx = (e.clientX - rect.left) * scaleX;
    const sy = (e.clientY - rect.top) * scaleY;
    // Save for overlay mapping
    this._lastRect = rect;
    this._lastScaleX = scaleX;
    this._lastScaleY = scaleY;

    let wx = null;
    let wy = null;
    if (this._camera) {
      try {
        const worldPos = screenToWorld(this._camera, sx, sy, canvas);
        if (Array.isArray(worldPos) && worldPos.length >= 2) {
          wx = worldPos[0];
          wy = worldPos[1];
        }
      } catch {
        wx = null;
        wy = null;
      }
    }

    return { sx, sy, wx, wy, cx: e.clientX, cy: e.clientY };
  }

  _resolvePointerOrigin() {
    if (this._getPointerOrigin) {
      try {
        const origin = this._getPointerOrigin();
        if (origin && typeof origin.x === "number" && typeof origin.y === "number") {
          return origin;
        }
      } catch {}
    }
    if (this._camera) {
      return { x: this._camera.x || 0, y: this._camera.y || 0 };
    }
    return null;
  }

  _beginGesture(e, pointer) {
    if (this._gesturePointerId !== null) return;
    this._gesturePointerId = e.pointerId;
    this._gesturePointerType = e.pointerType || "";
    this._gesturePoints = [];
    this._gestureWorldPoints = [];
    this._gestureClientPoints = [];
    this._gestureActive = false;
    const now = performance?.now ? performance.now() : Date.now();
    this._gestureDownTime = now;
    this._gestureStartTime = 0;
    this._accumulateGesturePoint(pointer, true);
    this._scheduleGestureHold(e.pointerId);
    try {
      if (e.target && typeof e.target.setPointerCapture === "function") {
        e.target.setPointerCapture(e.pointerId);
        this._gestureCaptureEl = e.target;
      } else {
        this._gestureCaptureEl = null;
      }
    } catch {
      this._gestureCaptureEl = null;
    }
  }

  _accumulateGesturePoint(pointer, force = false) {
    if (!pointer) return;
    const last = this._gesturePoints[this._gesturePoints.length - 1] || null;
    if (!force && last) {
      const dx = pointer.sx - last.x;
      const dy = pointer.sy - last.y;
      if (Math.hypot(dx, dy) < 4) {
        return;
      }
    }
    this._gesturePoints.push({ x: pointer.sx, y: pointer.sy });
    if (Number.isFinite(pointer.cx) && Number.isFinite(pointer.cy)) {
      this._gestureClientPoints.push({ x: pointer.cx, y: pointer.cy });
    }
    if (pointer.wx !== null && pointer.wy !== null) {
      this._gestureWorldPoints.push({ x: pointer.wx, y: pointer.wy });
    }
    // Debug overlay update
    try {
      window.dispatchEvent(new CustomEvent("ui:gestureProgress", {
        detail: {
          points: this._gestureClientPoints.slice(),
          active: this._gestureActive === true,
          phase: force ? 'start' : 'move',
        }
      }));
    } catch {}
  }

  _finalizeGesture(cancelled = false) {
    if (this._gesturePointerId !== null && this._gestureCaptureEl && typeof this._gestureCaptureEl.releasePointerCapture === "function") {
      try { this._gestureCaptureEl.releasePointerCapture(this._gesturePointerId); } catch {}
    }

    this._clearGestureHold();

    if (!cancelled && this._gesturePointerId !== null && this._gestureActive) {
      this._maybeEmitGesture();
    }
    // Clear overlay
    try { window.dispatchEvent(new CustomEvent("ui:gestureProgress", { detail: { points: [], active: false, phase: 'end', cancelled: !!cancelled } })); } catch {}
    this._gesturePointerId = null;
    this._gesturePointerType = "";
    this._gestureCaptureEl = null;
    this._gesturePoints = [];
    this._gestureWorldPoints = [];
    this._gestureClientPoints = [];
    this._gestureStartTime = 0;
    this._gestureDownTime = 0;
    this._gestureActive = false;
  }

  _maybeEmitGesture() {
    if (!this._gestureActive || !this._gesturePoints || this._gesturePoints.length < 6) return;
    const now = performance?.now ? performance.now() : Date.now();
    const start = this._gestureStartTime || this._gestureDownTime || now;
    const duration = (now - start) / 1000;
    if (!Number.isFinite(duration) || duration < 0.12) return;

    // Try meteor (diagonal) first; then lightning "Z".
    let recognized = null;
    let recognizedId = null;
    const mres = recognizeMeteorGesture(this._gesturePoints);
    if (mres) { recognized = mres; recognizedId = 'meteor'; }
    else {
      const lres = recognizeLightningGesture(this._gesturePoints);
      if (lres) { recognized = lres; recognizedId = 'lightning'; }
    }
    if (!recognized) return;

    const detail = {
      id: recognizedId,
      duration,
      pointerType: this._gesturePointerType,
      quality: recognized.quality,
      bounds: recognized.bounds,
      normalizedPath: recognized.normalizedPath,
      worldPath: this._gestureWorldPoints.length ? this._gestureWorldPoints.slice() : null,
    };
    // Debug recognition overlay hint
    try {
      const rect = this._lastRect || this._canvas?.getBoundingClientRect?.() || null;
      const sx = this._lastScaleX || 1;
      const sy = this._lastScaleY || 1;
      const b = recognized.bounds;
      const screenBounds = rect ? { x: rect.left + b.minX / (sx || 1), y: rect.top + b.minY / (sy || 1), w: b.width / (sx || 1), h: b.height / (sy || 1) } : null;
      window.dispatchEvent(new CustomEvent("ui:gestureProgress", { detail: { points: this._gestureClientPoints.slice(), active: true, recognized: { id: recognizedId, quality: recognized.quality, bounds: screenBounds }, phase: 'recognized' } }));
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent("input:spellGesture", { detail }));
    } catch {}
  }

  _scheduleGestureHold(pointerId) {
    this._clearGestureHold();
    const w = typeof window !== "undefined" ? window : null;
    if (!w || typeof w.setTimeout !== "function") return;
    this._gestureHoldTimer = w.setTimeout(() => {
      this._gestureHoldTimer = 0;
      if (this._gesturePointerId === pointerId && !this._gestureActive) {
        this._activateGesture();
      }
    }, GESTURE_HOLD_MS);
  }

  _clearGestureHold() {
    if (this._gestureHoldTimer) {
      const w = typeof window !== "undefined" ? window : null;
      if (w && typeof w.clearTimeout === "function") {
        w.clearTimeout(this._gestureHoldTimer);
      }
      this._gestureHoldTimer = 0;
    }
  }

  _shouldActivateGesture(pointer) {
    if (this._gestureActive || !this._gesturePoints.length) return false;
    const start = this._gesturePoints[0];
    const dx = pointer.sx - start.x;
    const dy = pointer.sy - start.y;
    return (dx * dx + dy * dy) >= GESTURE_DRAG_THRESHOLD_SQ;
  }

  _activateGesture() {
    if (this._gestureActive || this._gesturePointerId === null) return;
    this._clearGestureHold();
    this._gestureActive = true;
    this._gestureStartTime = performance?.now ? performance.now() : Date.now();
  }
}
