// display/camera/shake.js
// Procedural shake; visual-only

export function startShake(cam, amp = 3, dur = 0.25) {
  // Only override if new shake is stronger than remaining shake
  const remaining = cam._shakeDur ? (1 - cam._shakeTime / cam._shakeDur) * cam._shakeAmp : 0;
  if (amp < remaining) return;
  cam._shakeAmp = amp;
  cam._shakeDur = dur;
  cam._shakeTime = 0;
  cam._shakeSlam = false;
}

/**
 * Slam shake — one hard downward hit that snaps back.
 * Used for meteor impacts and other catastrophic events.
 */
export function startSlamShake(cam, amp = 14, dur = 0.45) {
  cam._shakeAmp = amp;
  cam._shakeDur = dur;
  cam._shakeTime = 0;
  cam._shakeSlam = true;
}

export function updateShake(cam, dt, rand = Math.random) {
  if (!cam._shakeDur) return;
  cam._shakeTime += dt;
  const k = cam._shakeTime / cam._shakeDur;
  if (k >= 1) {
    cam.shakeX = cam.shakeY = 0;
    cam._shakeDur = 0;
    cam._shakeSlam = false;
  } else if (cam._shakeSlam) {
    // Single hard downward slam with sharp exponential snap-back
    const hit = Math.exp(-k * 8) * cam._shakeAmp;
    cam.shakeX = (rand() - 0.5) * hit * 0.3;
    cam.shakeY = hit;
  } else {
    const fall = (1 - k) * cam._shakeAmp;
    cam.shakeX = (rand() - 0.5) * fall * 2;
    cam.shakeY = (rand() - 0.5) * fall * 2;
  }
}
