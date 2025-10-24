// Tile Render System
// Renders the tile/background layer aligned to the viewport grid
// READONLY: performs no mutations — only reads world state and draws to canvas
import { getRenderContext } from '../utils.js';

export function tileRenderSystem(world) {
  const rc = getRenderContext(world);
  if (!rc) return;
  const { ctx, W, H, cellW = 16, cellH = 16 } = rc;
  const cols = Math.max(1, rc.cols || Math.floor(W / cellW));
  const rows = Math.max(1, rc.rows || Math.floor(H / cellH));

  const camX = (rc.camX ?? -Math.floor(cols / 2));
  const camY = (rc.camY ?? -Math.floor(rows / 2));
  const startX = camX;
  const startY = camY;

  const ox = Math.floor((W - cols * cellW) / 2);
  const oy = Math.floor((H - rows * cellH) / 2);
  const halfShiftX = (cols % 2 === 0) ? -cellW / 2 : 0;
  const halfShiftY = (rows % 2 === 0) ? -cellH / 2 : 0;

  ctx.save();
  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, W, H);

  ctx.translate(ox + halfShiftX, oy + halfShiftY);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const worldX = startX + x;
      const worldY = startY + y;
      const isDark = ((worldX + worldY) & 1) !== 0;
      ctx.fillStyle = isDark ? '#2a2a2a' : '#303030';
      ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
    }
  }
  ctx.restore();
}
