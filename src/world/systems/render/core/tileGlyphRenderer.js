// Tile Glyph Render System
// Draws map glyphs from MapView (preferred) or falls back to Position+Tile entities.
// Placed after lighting so glyphs remain visible.
import { getRenderContext } from '../utils.js';
import { MapView } from '../../../components/MapView.js';
import { Position } from '../../../components/Position.js';
import { Tile } from '../../../components/Tile.js';
import { DevState } from '../../../components/DevState.js';
import { LightGrid, sampleLight } from '../../../singletons/LightGrid.js';
import { CameraLighting } from '../../../singletons/CameraLighting.js';

function toneMap(rgb, exposure){
  const e = exposure||1; return [1-Math.exp(-e*rgb[0]), 1-Math.exp(-e*rgb[1]), 1-Math.exp(-e*rgb[2])];
}
function gammaCorrect(rgb, gamma){ const inv = 1/(gamma||2.2); return [Math.pow(rgb[0], inv), Math.pow(rgb[1], inv), Math.pow(rgb[2], inv)]; }
function luminance(rgb){ return 0.2126*rgb[0] + 0.7152*rgb[1] + 0.0722*rgb[2]; }
function hexToRgb01(hex){
  if (!hex) return [1,1,1];
  const s = (''+hex).trim();
  if (s[0] === '#'){
    const n = parseInt(s.slice(1), 16);
    const r = ((n>>16)&255)/255, g=((n>>8)&255)/255, b=(n&255)/255;
    return [r,g,b];
  }
  return [1,1,1];
}
function rgb01ToHex(rgb){
  const r = Math.max(0, Math.min(255, (rgb[0]*255)|0));
  const g = Math.max(0, Math.min(255, (rgb[1]*255)|0));
  const b = Math.max(0, Math.min(255, (rgb[2]*255)|0));
  return '#'+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1);
}

export function tileGlyphRenderSystem(world){
  const rc = getRenderContext(world);
  if (!rc) return;
  const { ctx, W, H, cellW=16, cellH=16 } = rc;
  const cols = Math.max(1, rc.cols || Math.floor(W / cellW));
  const rows = Math.max(1, rc.rows || Math.floor(H / cellH));
  const camX = (rc.camX|0);
  const camY = (rc.camY|0);

  // Lighting controls
  let lgId = 0; for (const e of world.alive){ if (world.has(e, LightGrid)) { lgId = e; break; } }
  const lg = lgId ? world.get(lgId, LightGrid) : null;
  let clId = 0; for (const e of world.alive){ if (world.has(e, CameraLighting)) { clId = e; break; } }
  const cl = clId? world.get(clId, CameraLighting) : null;
  const exposure = cl?.exposure ?? 1.0; const gamma = cl?.gamma ?? 2.2;
  const scaleX = lg && lg.w ? (lg.w / Math.max(1, cols)) : 1;
  const scaleY = lg && lg.h ? (lg.h / Math.max(1, rows)) : 1;

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
  const outsideDim = (rc.fovOutsideDim != null) ? rc.fovOutsideDim : 0.0;

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
        
        // Base albedo by glyph
  let base = '#767676ff';
  if (g === '·') base = '#464646ff';
  else if (g === '█' || g === '#') base = '#e0e0e0';
  else if (g === '+' || g === '/') base = '#8b4513';

        // Apply lighting if LightGrid present
        if (lg && lg.r){
          const gx = (vx + 0.5) * scaleX;
          const gy = (vy + 0.5) * scaleY;
          const L = sampleLight(lg, gx, gy);
          const mapped = gammaCorrect(toneMap(L, exposure), gamma);
          // FOV factor similar to tileLighting
          let factor = 1;
          if (visMask){
            const v = visMask[vy*cols + vx] ? 1 : 0;
            if (!v){
              if (seenMask && x>=0 && y>=0 && x<mapW && y<mapH && seenMask[y*mapW + x]) factor = seenDim;
              else factor = outsideDim;
            }
          }
          const albedo = hexToRgb01(base.slice(0,7));
          const Lm = luminance(mapped);
          const baseTerm   = (rc.wallLightBase != null) ? rc.wallLightBase : 0.4;
          const diffuseAmt = (rc.wallLightDiffuse != null) ? rc.wallLightDiffuse : 0.7;
          const tintAmt    = (rc.wallLightTint != null) ? rc.wallLightTint : 0.3;
          const diffuse = [
            albedo[0] * (baseTerm + diffuseAmt * Lm),
            albedo[1] * (baseTerm + diffuseAmt * Lm),
            albedo[2] * (baseTerm + diffuseAmt * Lm)
          ];
          const tint = [mapped[0] * tintAmt, mapped[1] * tintAmt, mapped[2] * tintAmt];
          const out = [
            Math.max(0, Math.min(1, (diffuse[0] + tint[0]) * factor)),
            Math.max(0, Math.min(1, (diffuse[1] + tint[1]) * factor)),
            Math.max(0, Math.min(1, (diffuse[2] + tint[2]) * factor))
          ];
          ctx.fillStyle = rgb01ToHex(out);
        } else {
          ctx.fillStyle = base;
        }
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
  let base = '#c0c0c0';
  if (g === '·') base = '#b0b0b0';
  else if (g === '█' || g === '#') base = '#e0e0e0';
  else if (g === '+' || g === '/') base = '#8b4513';

    if (lg && lg.r){
      const vx = x - camX; const vy = y - camY;
      const gx = (vx + 0.5) * scaleX; const gy = (vy + 0.5) * scaleY;
      const L = sampleLight(lg, gx, gy);
      const mapped = gammaCorrect(toneMap(L, exposure), gamma);
      let factor = 1;
      if (visMask){
        const v = (vx>=0 && vy>=0 && vx<cols && vy<rows) ? (visMask[vy*cols + vx]?1:0) : 0;
        if (!v){
          if (seenMask && x>=0 && y>=0 && x<mapW && y<mapH && seenMask[y*mapW + x]) factor = seenDim;
          else factor = outsideDim;
        }
      }
      const albedo = hexToRgb01(base);
      const Lm = luminance(mapped);
      const baseTerm   = (rc.wallLightBase != null) ? rc.wallLightBase : 0.4;
      const diffuseAmt = (rc.wallLightDiffuse != null) ? rc.wallLightDiffuse : 0.7;
      const tintAmt    = (rc.wallLightTint != null) ? rc.wallLightTint : 0.3;
      const diffuse = [
        albedo[0] * (baseTerm + diffuseAmt * Lm),
        albedo[1] * (baseTerm + diffuseAmt * Lm),
        albedo[2] * (baseTerm + diffuseAmt * Lm)
      ];
      const tint = [mapped[0] * tintAmt, mapped[1] * tintAmt, mapped[2] * tintAmt];
      const out = [
        Math.max(0, Math.min(1, (diffuse[0] + tint[0]) * factor)),
        Math.max(0, Math.min(1, (diffuse[1] + tint[1]) * factor)),
        Math.max(0, Math.min(1, (diffuse[2] + tint[2]) * factor))
      ];
      ctx.fillStyle = rgb01ToHex(out);
    } else {
      ctx.fillStyle = base;
    }
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
