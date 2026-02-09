// display/passes/lightmask/index.js
// Draw a dark overlay for tiles not visible by FOV, in world units.

/**
 * Draw darkness over non-visible tiles within [vx0..vx1]x[vy0..vy1] world bounds.
 * ctx is assumed to be under the camera/world transform already.
 * visible is a Set of "x,y" tile keys or a predicate (x,y)=>boolean.
 */
export function drawLightMask(ctx, visible, vx0, vy0, vx1, vy1, alpha = 0.72) {
  const isVisible = (typeof visible === 'function')
    ? visible
    : (x, y) => !!(visible && visible.has(`${x},${y}`));
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  const x0 = Math.floor(vx0);
  const y0 = Math.floor(vy0);
  const x1 = Math.ceil(vx1);
  const y1 = Math.ceil(vy1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!isVisible(x, y)) {
        ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
      }
    }
  }
  ctx.restore();
}
