// display/camera/controller.js
// Core camera resource (pure data + helpers)

export function createCamera() {
  return {
    x: 0,
    y: 0,
    scale: 1,
    targetX: 0,
    targetY: 0,
    targetScale: 1,
    lerpSpeed: 4.0,
    shakeX: 0,
    shakeY: 0
  };
}

export function updateCamera(cam, dt) {
  const t = Math.min(1, cam.lerpSpeed * dt);
  cam.x += (cam.targetX - cam.x) * t;
  cam.y += (cam.targetY - cam.y) * t;
  cam.scale += (cam.targetScale - cam.scale) * t;
}

export function applyCamera(ctx, cam, canvas) {
  // Respect any pre-existing base scale (e.g., DPR transform)
  const m = typeof ctx.getTransform === 'function' ? ctx.getTransform() : { a: 1, d: 1 };
  const baseX = m?.a || 1;
  const baseY = m?.d || 1;
  const sx = baseX * cam.scale;
  const sy = baseY * cam.scale;
  let tx = canvas.width / 2  - cam.x * sx + cam.shakeX * baseX;
  let ty = canvas.height / 2 - cam.y * sy + cam.shakeY * baseY;
  // Pixel-snapping translation avoids subpixel blur and improves mobile perf
  tx = Math.round(tx);
  ty = Math.round(ty);
  ctx.setTransform(sx, 0, 0, sy, tx, ty);
}

export function worldToScreen(cam, wx, wy, canvas) {
  const cx = canvas.width  / 2;
  const cy = canvas.height / 2;
  const sx = cx + (wx - cam.x) * cam.scale + cam.shakeX;
  const sy = cy + (wy - cam.y) * cam.scale + cam.shakeY;
  return [sx, sy];
}

export function screenToWorld(cam, sx, sy, canvas) {
  const cx = canvas.width  / 2;
  const cy = canvas.height / 2;
  const wx = (sx - cx - cam.shakeX) / cam.scale + cam.x;
  const wy = (sy - cy - cam.shakeY) / cam.scale + cam.y;
  return [wx, wy];
}
