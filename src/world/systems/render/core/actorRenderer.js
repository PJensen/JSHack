// Actor Render System
// Draws all Position+Glyph entities that are not the player and not items, with base colors.
// This provides a base pass for actors so the lighting system can modulate them afterwards.
import { getRenderContext } from '../utils.js';
import { Position } from '../../../components/Position.js';
import { Glyph } from '../../../components/Glyph.js';
import { Player } from '../../../components/Player.js';
import { Gold } from '../../../components/Gold.js';

export function actorRenderSystem(world){
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
  ctx.font = font || '18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // FOV gating similar to items
  const visW = (rc.visibleWeight instanceof Float32Array && rc.visibleWeight.length === cols*rows) ? rc.visibleWeight : null;
  const vis = (!visW && rc.visibleMask instanceof Uint8Array && rc.visibleMask.length === cols*rows) ? rc.visibleMask : null;

  for (const [id, pos, glyph] of world.query(Position, Glyph)){
    if (world.has(id, Player)) continue;      // player drawn by dedicated renderer
    if (world.has(id, Gold)) continue;        // items drawn by itemRenderSystem
  // No generic Item filter; actors can include any glyph entity that's not the player or gold

    const mx = (pos.x - camX);
    const my = (pos.y - camY);
    if (mx < -1 || my < -1 || mx > cols + 1 || my > rows + 1) continue;

    // Skip if not visible (when masks are provided)
    if (visW){ const w = visW[(my|0)*cols + (mx|0)] || 0; if (w <= 0.02) continue; }
    else if (vis){ if (!vis[(my|0)*cols + (mx|0)]) continue; }

    const sx = mx * cellW + cellW * 0.5;
    const sy = my * cellH + cellH * 0.5;
    ctx.fillStyle = glyph.fg || glyph.color || '#ffffff';
    ctx.fillText(glyph.char || '?', sx, sy);
  }

  ctx.restore();
}
