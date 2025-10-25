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
  const halfShiftX = (cols % 2 === 0) ? -cellW / 2 : 0;
  const halfShiftY = (rows % 2 === 0) ? -cellH / 2 : 0;
  const cx = cellW * 0.5;
  const cy = cellH * 0.5;

  const minX = camX;
  const minY = camY;
  const maxX = camX + cols;
  const maxY = camY + rows;

  // Direct draw of MapView glyphs using same coordinate system as items
  for (const [mvid, mv] of world.query(MapView)){
    const glyphAt = mv && mv.glyphAt;
    if (typeof glyphAt !== 'function') continue;

    ctx.save();
    ctx.translate(ox + halfShiftX, oy + halfShiftY);
    ctx.font = rc.font || '18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (let y=minY; y<maxY; y++){
      for (let x=minX; x<maxX; x++){
        const g = glyphAt(x,y) || '';
        // Skip rendering void/empty tiles (already black background)
        if (!g || g === ' ') continue;
        
        const mx = (x - camX);
        const my = (y - camY);
        const screenX = mx * cellW + cx;
        const screenY = my * cellH + cy;
        
        if (g === '·') ctx.fillStyle = '#b0b0b0';
        else if (g === '█') ctx.fillStyle = '#e0e0e0';
        else if (g === '🚪') ctx.fillStyle = '#8b4513';
        else ctx.fillStyle = '#c0c0c0';
        ctx.fillText(g, screenX, screenY);
      }
    }
    ctx.restore();
    return;
  }

  // Fallback: Position+Tile+Glyph entities (for manually placed walls)
  ctx.save();
  ctx.translate(ox + halfShiftX, oy + halfShiftY);
  ctx.font = rc.font || '18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  for (const [id, pos, tile] of world.query(Position, Tile)){
    const x = pos.x|0, y = pos.y|0;
    if (x < minX || x >= maxX || y < minY || y >= maxY) continue;
    
    const mx = (x - camX);
    const my = (y - camY);
    const screenX = mx * cellW + cx;
    const screenY = my * cellH + cy;
    
    const g = tile.glyph || '.';
    if (g === '·') ctx.fillStyle = '#b0b0b0';
    else if (g === '█' || g === '#') ctx.fillStyle = '#e0e0e0';
    else ctx.fillStyle = '#c0c0c0';
    ctx.fillText(g, screenX, screenY);
  }
  ctx.restore();
}
