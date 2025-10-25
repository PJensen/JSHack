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

  // Fast path: render map glyphs to an offscreen surface once, then blit viewport slice each frame
  // This avoids N*fillText per frame and keeps rAF < ~16ms for large viewports.
  for (const [mvid, mv] of world.query(MapView)){
    const glyphAt = mv && mv.glyphAt;
    if (typeof glyphAt !== 'function') continue;

    // Build or reuse offscreen surface when map/cell/font changes
    const needRebuild = (() => {
      const surf = rc._mapSurface;
      if (!surf) return true;
      if (surf.mapW !== (mv.w|0) || surf.mapH !== (mv.h|0)) return true;
      if (surf.cellW !== cellW || surf.cellH !== cellH) return true;
      if (surf.font !== (rc.font || '18px monospace')) return true;
      return false;
    })();

    if (needRebuild){
      try{
        const can = document.createElement('canvas');
        can.width = Math.max(1, (mv.w|0) * cellW);
        can.height = Math.max(1, (mv.h|0) * cellH);
        const c2 = can.getContext('2d');
        c2.font = rc.font || '18px monospace';
        c2.textAlign = 'center';
        c2.textBaseline = 'middle';
        // Draw full map once
        for (let y=0; y<(mv.h|0); y++){
          for (let x=0; x<(mv.w|0); x++){
            const g = glyphAt(x,y) || '';
            if (!g) continue;
            const sx = x * cellW + cx;
            const sy = y * cellH + cy;
            if (g === '·') c2.fillStyle = '#b0b0b0';
            else if (g === '█') c2.fillStyle = '#e0e0e0';
            else c2.fillStyle = '#c0c0c0';
            c2.fillText(g, sx, sy);
          }
        }
        rc._mapSurface = { canvas: can, mapW: (mv.w|0), mapH: (mv.h|0), cellW, cellH, font: (rc.font || '18px monospace') };
      }catch(e){ /* fallback to direct draw below */ rc._mapSurface = null; }
    }

    const surf = rc._mapSurface;
    if (surf && surf.canvas){
      // Clamp source rect to surface bounds
      const sx = Math.max(0, Math.min(camX * cellW, surf.canvas.width));
      const sy = Math.max(0, Math.min(camY * cellH, surf.canvas.height));
      const sw = Math.max(0, Math.min(cols * cellW, surf.canvas.width - sx));
      const sh = Math.max(0, Math.min(rows * cellH, surf.canvas.height - sy));
      if (sw > 0 && sh > 0){
        ctx.drawImage(surf.canvas, sx, sy, sw, sh, ox, oy, sw, sh);
      }
      return;
    }

    // Fallback: direct draw of viewport (rare path)
    ctx.save();
    ctx.font = rc.font || '18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let y=minY; y<maxY; y++){
      for (let x=minX; x<maxX; x++){
        const g = glyphAt(x,y) || '';
        if (!g) continue;
        const dx = ox + (x - camX) * cellW + cx;
        const dy = oy + (y - camY) * cellH + cy;
        if (g === '·') ctx.fillStyle = '#b0b0b0';
        else if (g === '█') ctx.fillStyle = '#e0e0e0';
        else ctx.fillStyle = '#c0c0c0';
        ctx.fillText(g, dx, dy);
      }
    }
    ctx.restore();
    return;
  }

  // Fallback: Position+Tile iteration (kept for compatibility; slower)
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
}
