// Item Render System
// Renders items (e.g., gold) on the map aligned to the tile grid
// READONLY: performs no mutations — only reads world state and draws to canvas
import { getRenderContext } from '../utils.js';
import { Position } from '../../../components/Position.js';
import { Glyph } from '../../../components/Glyph.js';
import { Gold } from '../../../components/Gold.js';
import { Player } from '../../../components/Player.js';

export function itemRenderSystem(world) {
  const rc = getRenderContext(world);
  if (!rc) return;
  const { ctx, W, H, cellW = 16, cellH = 16, font } = rc;
  const cols = Math.max(1, rc.cols | 0), rows = Math.max(1, rc.rows | 0);
  const camX = rc.camX | 0, camY = rc.camY | 0;
  const ox = Math.floor((W - cols * cellW) / 2);
  const oy = Math.floor((H - rows * cellH) / 2);
  const halfShiftX = (cols % 2 === 0) ? -cellW / 2 : 0;
  const halfShiftY = (rows % 2 === 0) ? -cellH / 2 : 0;

  ctx.save();
  ctx.translate(ox + halfShiftX, oy + halfShiftY);
  ctx.font = font || '16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // FOV gating: only render items when tile is currently visible
  const visW = (rc.visibleWeight instanceof Float32Array && rc.visibleWeight.length === cols*rows) ? rc.visibleWeight : null;
  const vis = (!visW && rc.visibleMask instanceof Uint8Array && rc.visibleMask.length === cols*rows) ? rc.visibleMask : null;

  for (const [id, pos, glyph, gold] of world.query(Position, Glyph, Gold)) {
    if (world.has(id, Player)) continue; // don't draw on player entity

    const mx = (pos.x - camX);
    const my = (pos.y - camY);
    if (mx < -1 || my < -1 || mx > cols + 1 || my > rows + 1) continue;
    // Skip if not visible
    if (visW){ const w = visW[(my|0)*cols + (mx|0)] || 0; if (w <= 0.02) continue; }
    else if (vis){ if (!vis[(my|0)*cols + (mx|0)]) continue; }

    const screenX = mx * cellW + cellW * 0.5;
    const screenY = my * cellH + cellH * 0.5;
    ctx.fillStyle = glyph.fg || glyph.color || '#ffd700';
    ctx.fillText(glyph.char || '$', screenX, screenY);
  }

  ctx.restore();
}
