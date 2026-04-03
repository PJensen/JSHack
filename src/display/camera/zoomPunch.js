// display/camera/zoomPunch.js
// Brief camera scale pulse on critical hits — "zoom punch".
// Snaps scale up by a small amount, then eases back to 1.0.
// Additive: applies on top of the camera's normal scale, just like shake.

/** Peak zoom boost (fraction above 1.0). 0.02 = 2% zoom-in. */
const PUNCH_PEAK = 0.02;

/** Duration of the full punch cycle (seconds of real time). */
const PUNCH_DURATION = 0.12;

/** Ease-out: time spent ramping back to 1.0 (as fraction of duration). */
const EASE_FRAC = 0.7;

export function startZoomPunch(cam, peak = PUNCH_PEAK, dur = PUNCH_DURATION) {
  cam._zpPeak = peak;
  cam._zpDur = dur;
  cam._zpTime = 0;
}

export function updateZoomPunch(cam, dt) {
  if (!cam._zpDur) return;
  cam._zpTime += dt;
  const k = cam._zpTime / cam._zpDur;
  if (k >= 1) {
    cam._zpScale = 0;
    cam._zpDur = 0;
    return;
  }
  const attackEnd = 1 - EASE_FRAC;
  let intensity;
  if (k < attackEnd) {
    // Snap up to peak
    intensity = k / attackEnd;
  } else {
    // Ease back to 0
    const t = (k - attackEnd) / EASE_FRAC;
    intensity = 1 - t * t; // quadratic ease-out
  }
  cam._zpScale = cam._zpPeak * intensity;
}

/** Get the additive scale offset to apply this frame. */
export function getZoomPunchScale(cam) {
  return cam._zpScale || 0;
}
