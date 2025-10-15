// display/camera/follow.js
// Smoothly follow a target position each frame

export function followEntity(cam, targetPos, dt, ease = 4.0) {
  const t = Math.min(1, ease * dt);
  cam.targetX = targetPos.x;
  cam.targetY = targetPos.y;
  cam.x += (cam.targetX - cam.x) * t;
  cam.y += (cam.targetY - cam.y) * t;
}
