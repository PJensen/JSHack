// Tile Glyph Render System
// Draws map glyphs from MapView (preferred) or falls back to Position+Tile entities.
// Placed after lighting so glyphs remain visible.
import { getRenderContext } from '../utils.js';
import { MapView } from '../../../components/MapView.js';
import { Position } from '../../../components/Position.js';
import { Tile } from '../../../components/Tile.js';

export function tileGlyphRenderSystem(world){
  const rc = getRenderContext(world);
  if (!rc) return;
  const { ctx, W, H, cellW=16, cellH=16 } = rc;
  const cols = Math.max(1, rc.cols || Math.floor(W / cellW));
  const rows = Math.max(1, rc.rows || Math.floor(H / cellH));
  const camX = (rc.camX|0);
  const camY = (rc.camY|0);

  const ox = Math.floor((W - cols * cellW) / 2);
  const oy = Math.floor((H - rows * cellH) / 2);
  const cx = cellW * 0.5;
  const cy = cellH * 0.5;

  const minX = camX;
  const minY = camY;
  const maxX = camX + cols;
  const maxY = camY + rows;

  ctx.save();
  ctx.font = rc.font || '18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Prefer MapView; skip any that aren't initialized yet
  for (const [mvid, mv] of world.query(MapView)){
    const glyphAt = mv && mv.glyphAt;
    if (typeof glyphAt !== 'function') continue;

    for (let y=minY; y<maxY; y++){
      for (let x=minX; x<maxX; x++){
        const g = glyphAt(x,y) || '';
        if (!g) continue;
        const sx = ox + (x - camX) * cellW + cx;
        const sy = oy + (y - camY) * cellH + cy;
        if (g === '·') ctx.fillStyle = '#b0b0b0';
        else if (g === '█') ctx.fillStyle = '#e0e0e0';
        else ctx.fillStyle = '#c0c0c0';
        ctx.fillText(g, sx, sy);
      }
    }
    ctx.restore();
    return;
  }

  // Fallback: Position+Tile iteration
  for (const [id, pos, tile] of world.query(Position, Tile)){
    const x = pos.x|0, y = pos.y|0;
    if (x < minX || x >= maxX || y < minY || y >= maxY) continue;
    const sx = ox + (x - camX) * cellW + cx;
    const sy = oy + (y - camY) * cellH + cy;
    const g = tile.glyph || '.';
    if (g === '·') ctx.fillStyle = '#b0b0b0';
    else if (g === '█') ctx.fillStyle = '#e0e0e0';
    else ctx.fillStyle = '#c0c0c0';
    ctx.fillText(g, sx, sy);
  }

  ctx.restore();
}
