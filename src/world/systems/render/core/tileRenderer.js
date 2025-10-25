// Tile Background Render System
// Renders background for dungeon tiles (solid color, no borders)
// READONLY: performs no mutations — only reads world state and draws to canvas
import { getRenderContext } from '../utils.js';

export function tileRenderSystem(world) {
  const rc = getRenderContext(world);
  if (!rc) return;
  const { ctx, W, H } = rc;

  // Clear to solid background (no viewport boundaries, no checkerboard)
  ctx.save();
  ctx.fillStyle = rc.bg || '#0f1320';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
