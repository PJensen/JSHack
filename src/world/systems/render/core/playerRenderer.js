// Player Render System
// Draws the player at the center of the canvas
// READONLY: performs no mutations — only reads world state and draws to canvas
import { Position } from '../../../components/Position.js';
import { Player } from '../../../components/Player.js';
import { Glyph } from '../../../components/Glyph.js';
import { getRenderContext } from '../utils.js';

export function playerRenderSystem(world) {
  const rc = getRenderContext(world);
  if (!rc) return;
  const { ctx, W, H, font } = rc;
  const cellW = rc.cellW || 16;
  const cellH = rc.cellH || 16;
  const cols = Math.max(1, rc.cols || Math.floor(W / cellW));
  const rows = Math.max(1, rc.rows || Math.floor(H / cellH));
  const camX = rc.camX | 0;
  const camY = rc.camY | 0;

  const ox = Math.floor((W - cols * cellW) / 2);
  const oy = Math.floor((H - rows * cellH) / 2);
  const halfShiftX = (cols % 2 === 0) ? -cellW / 2 : 0;
  const halfShiftY = (rows % 2 === 0) ? -cellH / 2 : 0;
  const cx = cellW * 0.5;
  const cy = cellH * 0.5;

  ctx.save();
  ctx.translate(ox + halfShiftX, oy + halfShiftY);
  ctx.font = font || '18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const [id, pos, glyph] of world.query(Position, Glyph, Player)) {
    const x = pos.x | 0, y = pos.y | 0;
    if (x < camX || x >= camX + cols || y < camY || y >= camY + rows) continue;
    const mx = (x - camX);
    const my = (y - camY);
    const sx = mx * cellW + cx;
    const sy = my * cellH + cy;
    ctx.fillStyle = (glyph && (glyph.fg || glyph.color)) || '#fff';
    ctx.fillText((glyph && glyph.char) || '@', sx, sy);
    // Only one player
    break;
  }

  ctx.restore();
}
