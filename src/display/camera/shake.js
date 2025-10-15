// display/camera/shake.js
// Small procedural shake; visual-only

export function startShake(cam, amp = 3, dur = 0.25) {
  cam._shakeAmp = amp;
  cam._shakeDur = dur;
  cam._shakeTime = 0;
}

export function updateShake(cam, dt, rand = Math.random) {
  if (!cam._shakeDur) return;
  cam._shakeTime += dt;
  const k = cam._shakeTime / cam._shakeDur;
  if (k >= 1) {
    cam.shakeX = cam.shakeY = 0;
    cam._shakeDur = 0;
  } else {
    const fall = (1 - k) * cam._shakeAmp;
    cam.shakeX = (rand() - 0.5) * fall * 2;
    cam.shakeY = (rand() - 0.5) * fall * 2;
  }
}
