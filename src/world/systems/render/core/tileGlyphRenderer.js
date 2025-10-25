// Tile Glyph Render System
// Draws map glyphs from MapView (preferred) or falls back to Position+Tile entities.
// Placed after lighting so glyphs remain visible.
import { getRenderContext } from '../utils.js';
import { MapView } from '../../../components/MapView.js';
import { Position } from '../../../components/Position.js';
import { Tile } from '../../../components/Tile.js';
import { DevState } from '../../../components/DevState.js';

export function tileGlyphRenderSystem(world){
  const rc = getRenderContext(world);
  if (!rc) return;
  const { ctx, W, H, cellW=16, cellH=16 } = rc;
  const cols = Math.max(1, rc.cols || Math.floor(W / cellW));
  const rows = Math.max(1, rc.rows || Math.floor(H / cellH));
  const camX = (rc.camX|0);
  const camY = (rc.camY|0);

  // Check if FOV-only rendering is enabled; we still draw seen tiles (dim)
  let fovOnly = false;
  for (const [id, dev] of world.query(DevState)) { fovOnly = !!dev.fovOnlyRender; break; }
  const visMask = rc.visibleMask instanceof Uint8Array ? rc.visibleMask : null;
  // Pull seenMask from MapView for fog-of-war memory
  let seenMask = null, mapW = 0, mapH = 0;
  try{
    let mv = null; const mvId = world.mapViewId;
    if (mvId) mv = world.get(mvId, MapView);
    if (!mv){ for (const [_id,_mv] of world.query(MapView)){ mv = _mv; break; } }
    if (mv && (mv.w|0)>0 && (mv.h|0)>0 && (mv.seenMask instanceof Uint8Array)){
      seenMask = mv.seenMask; mapW = mv.w|0; mapH = mv.h|0;
    }
  }catch(_){ /* ignore */ }
  const seenDim = (rc.fovSeenDim != null) ? rc.fovSeenDim : 0.08; // darker default for seen-but-not-visible
  const seenBlurPx = (rc.fogSeenBlurPx != null) ? rc.fogSeenBlurPx : 0.0; // default 0 for performance; opt-in if desired

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
        // FOV/Fog: decide visibility state for this map tile
        const vx = x - camX; const vy = y - camY;
        let isVisible = false; let isSeen = false;
        if (vx>=0 && vy>=0 && vx<cols && vy<rows && visMask){ isVisible = !!visMask[vy*cols + vx]; }
        if (!isVisible && seenMask && x>=0 && y>=0 && x<mapW && y<mapH){ isSeen = !!seenMask[y*mapW + x]; }
        if (fovOnly && !isVisible && !isSeen) continue; // hard skip unknown tiles
        
        const g = glyphAt(x,y) || '';
        // Skip rendering void/empty tiles (already black background)
        if (!g || g === ' ') continue;
          
        const mx = (x - camX);
        const my = (y - camY);
        const screenX = mx * cellW + cx;
        const screenY = my * cellH + cy;
        
        if (g === '·') ctx.fillStyle = '#464646ff';
        else if (g === '█') ctx.fillStyle = '#e0e0e0';
        else if (g === '🚪') ctx.fillStyle = '#8b4513';
        else ctx.fillStyle = '#767676ff';
        if (!isVisible && isSeen){
          const prevA = ctx.globalAlpha; const prevF = ctx.filter || 'none';
          ctx.globalAlpha = Math.max(0, Math.min(1, seenDim));
          if (seenBlurPx > 0) ctx.filter = `blur(${seenBlurPx}px)`;
          ctx.fillText(g, screenX, screenY);
          ctx.globalAlpha = prevA; ctx.filter = prevF;
        }
  else { ctx.fillText(g, screenX, screenY); }
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
    
    // FOV/Fog for manual tiles
    const vx = x - camX; const vy = y - camY;
    let isVisible = false; let isSeen = false;
    if (vx>=0 && vy>=0 && vx<cols && vy<rows && visMask){ isVisible = !!visMask[vy*cols + vx]; }
    if (!isVisible && seenMask && x>=0 && y>=0 && x<mapW && y<mapH){ isSeen = !!seenMask[y*mapW + x]; }
    if (fovOnly && !isVisible && !isSeen) continue; // unknown -> skip
    
    const mx = (x - camX);
    const my = (y - camY);
    const screenX = mx * cellW + cx;
    const screenY = my * cellH + cy;
    
    const g = tile.glyph || '.';
    if (g === '·') ctx.fillStyle = '#b0b0b0';
    else if (g === '█' || g === '#') ctx.fillStyle = '#e0e0e0';
    else ctx.fillStyle = '#c0c0c0';
    if (!isVisible && isSeen){
      const prevA = ctx.globalAlpha; const prevF = ctx.filter || 'none';
      ctx.globalAlpha = Math.max(0, Math.min(1, seenDim));
      if (seenBlurPx > 0) ctx.filter = `blur(${seenBlurPx}px)`;
      ctx.fillText(g, screenX, screenY);
      ctx.globalAlpha = prevA; ctx.filter = prevF;
    }
  else { ctx.fillText(g, screenX, screenY); }
  }
  ctx.restore();
}
