// display/fx/deathVfxController.js
// Multi-phase player death VFX:
//   Phase 0 — low HP warning: pulsing red vignette + heartbeat throb
//   Phase 1 — killing blow:   hard hitstop, white→crimson flash, camera shake, jingle
//   Phase 2 — death sequence:  glyph blink (fast→slow flatline), world desaturation sweep
//
// The existing post-mortem blind (main.js) handles the final fade-to-black after this.

import { startShake } from "../camera/shake.js";

// ── Tuning ──────────────────────────────────────────────────────────

/** HP ratio below which the heartbeat vignette kicks in */
const LOW_HP_THRESHOLD = 0.25;

/** Heartbeat pulse rate (Hz) — resting ~72 BPM = 1.2 Hz */
const HEARTBEAT_HZ = 1.2;

/** How long the death blink sequence lasts (seconds) */
const DEATH_BLINK_DURATION = 2.0;

/** Hitstop duration for the killing blow on the PLAYER (seconds) */
const PLAYER_KILL_HITSTOP = 0.40;

/** Camera shake for killing blow */
const DEATH_SHAKE_AMP = 6;
const DEATH_SHAKE_DUR = 0.50;

/** Screen flash: white peak then crimson fade */
const FLASH_DURATION = 0.8;

/** World desaturation ramp time after death (seconds) */
const DESAT_RAMP = 1.6;

// ── Controller ──────────────────────────────────────────────────────

export function createDeathVfxController() {
  let _dead = false;
  let _deathTime = 0;       // seconds since death
  let _playerHpRatio = 1;   // 0..1, updated each frame from worldView
  let _flashTime = -1;      // -1 = no flash active
  let _cam = null;

  // ── Public API ──────────────────────────────────────────────────

  /**
   * Call once per frame with real dt (not hitstop-scaled).
   */
  function tick(dtSec) {
    if (_dead) {
      _deathTime += dtSec;
    }
    if (_flashTime >= 0) {
      _flashTime += dtSec;
      if (_flashTime > FLASH_DURATION) _flashTime = -1;
    }
  }

  /**
   * Feed current player HP ratio (0..1) each frame.
   */
  function setPlayerHpRatio(ratio) {
    _playerHpRatio = Math.max(0, Math.min(1, ratio));
  }

  /**
   * Trigger the death sequence. Called from the 'died' event handler.
   */
  function triggerDeath({ cam, hitstopFx }) {
    if (_dead) return;
    _dead = true;
    _deathTime = 0;
    _flashTime = 0;
    _cam = cam;

    // Extended hitstop
    if (hitstopFx) hitstopFx.request(PLAYER_KILL_HITSTOP);

    // Heavy camera shake
    if (cam) startShake(cam, DEATH_SHAKE_AMP, DEATH_SHAKE_DUR);

  }

  /**
   * Is the death sequence active?
   */
  function isDead() { return _dead; }

  // ── Glyph blink ────────────────────────────────────────────────

  /**
   * Returns the alpha multiplier for the player glyph (0 or 1 during blink).
   * After blink sequence ends, returns a dim value that the post-mortem blind
   * will further fade.
   */
  function getPlayerGlyphAlpha(fxTime) {
    if (!_dead) return 1;

    const t = _deathTime;
    if (t > DEATH_BLINK_DURATION) {
      // Blink done — stay visible (post-mortem blind handles final fade)
      return 1;
    }

    // Blink rate: starts fast (12 Hz), decelerates to ~2 Hz like a flatline
    const progress = t / DEATH_BLINK_DURATION; // 0→1
    const hz = 12 - 10 * progress;             // 12 Hz → 2 Hz
    const phase = Math.sin(t * hz * Math.PI * 2);
    // Sharp square-wave blink: visible when phase > 0
    return phase > 0 ? 1 : 0;
  }

  // ── Low HP vignette (screen-space) ─────────────────────────────

  /**
   * Draw pulsing red vignette when HP is low. Call in screen-space (after present).
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} W  canvas width
   * @param {number} H  canvas height
   * @param {number} fxTime
   */
  function drawLowHpVignette(ctx, W, H, fxTime) {
    // During death: intensify then fade
    let intensity;
    if (_dead) {
      const t = _deathTime;
      if (t < 0.3) {
        // Spike to full intensity on death
        intensity = 0.7 + 0.3 * (t / 0.3);
      } else if (t < 2.0) {
        // Slowly fade out
        intensity = 1.0 - ((t - 0.3) / 1.7) * 0.7;
      } else {
        intensity = 0.3;
      }
    } else if (_playerHpRatio >= LOW_HP_THRESHOLD) {
      return; // HP is fine, no vignette
    } else {
      // Scale intensity: at threshold → 0, at 0 HP → 0.7
      const danger = 1 - (_playerHpRatio / LOW_HP_THRESHOLD); // 0→1
      const heartbeat = 0.5 + 0.5 * Math.sin(fxTime * HEARTBEAT_HZ * Math.PI * 2);
      // Pulse between base and peak
      const base = 0.15 * danger;
      const peak = 0.55 * danger;
      intensity = base + (peak - base) * heartbeat;
    }

    if (intensity < 0.01) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";

    // Radial gradient: transparent center → red edges
    const cx = W / 2, cy = H / 2;
    const outerR = Math.max(W, H) * 0.75;
    const innerR = Math.min(W, H) * 0.25;
    const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.5, `rgba(80,0,0,${(intensity * 0.4).toFixed(3)})`);
    grad.addColorStop(1, `rgba(120,8,8,${(intensity * 0.75).toFixed(3)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // ── Screen flash (white → crimson) ─────────────────────────────

  /**
   * Draw the death screen flash. Call in screen-space (after present).
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} W
   * @param {number} H
   */
  function drawDeathFlash(ctx, W, H) {
    if (_flashTime < 0) return;
    const t = _flashTime / FLASH_DURATION; // 0→1

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (t < 0.15) {
      // White flash peak
      const a = (1 - t / 0.15) * 0.6;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    } else {
      // Crimson fade
      const k = (t - 0.15) / 0.85; // 0→1
      const a = (1 - k) * 0.35;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(140,10,10,${a.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
  }

  // ── World desaturation ─────────────────────────────────────────

  /**
   * Draw a desaturation overlay that ramps up after death.
   * Uses a semi-transparent grey overlay with 'saturation' blend mode.
   * Call in screen-space (after present, before other overlays).
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} W
   * @param {number} H
   */
  function drawDesaturation(ctx, W, H) {
    let amount;
    if (_dead) {
      amount = Math.min(1, _deathTime / DESAT_RAMP);
    } else if (_playerHpRatio < LOW_HP_THRESHOLD) {
      // Subtle desaturation at low HP
      const danger = 1 - (_playerHpRatio / LOW_HP_THRESHOLD);
      amount = danger * 0.2;
    } else {
      return;
    }
    if (amount < 0.01) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "saturation";
    // Grey fill in saturation mode desaturates the image beneath
    const grey = Math.round(128 + 20 * (1 - amount)); // slightly brighter grey
    ctx.fillStyle = `rgba(${grey},${grey},${grey},${(amount * 0.65).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // ── Player glyph heartbeat throb ───────────────────────────────

  /**
   * Returns a scale multiplier (0.95–1.08) for the player glyph when at low HP.
   * Creates a subtle "breathing" throb in sync with the heartbeat vignette.
   */
  function getPlayerGlyphScale(fxTime) {
    if (_dead) return 1;
    if (_playerHpRatio >= LOW_HP_THRESHOLD) return 1;
    const danger = 1 - (_playerHpRatio / LOW_HP_THRESHOLD);
    const heartbeat = Math.sin(fxTime * HEARTBEAT_HZ * Math.PI * 2);
    // Sharp pump on the beat, gentle return
    const pump = heartbeat > 0 ? heartbeat * heartbeat : 0;
    return 1 + pump * 0.08 * danger;
  }

  /**
   * Reset state (e.g. on new game).
   */
  function reset() {
    _dead = false;
    _deathTime = 0;
    _flashTime = -1;
    _playerHpRatio = 1;
    _cam = null;
  }

  return {
    tick,
    setPlayerHpRatio,
    triggerDeath,
    isDead,
    getPlayerGlyphAlpha,
    getPlayerGlyphScale,
    drawLowHpVignette,
    drawDeathFlash,
    drawDesaturation,
    reset,
  };
}
