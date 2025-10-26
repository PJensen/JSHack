// Wall Geometry Renderer
// Draws walls as geometric edges (lines) using MapView/Tile data, with FOV and lighting aware colors.
// READONLY: performs no mutations — only reads world state and draws to canvas
import { getRenderContext } from '../utils.js';
import { MapView } from '../../../components/MapView.js';
import { Position } from '../../../components/Position.js';
import { Tile } from '../../../components/Tile.js';
import { LightGrid, sampleLight } from '../../../singletons/LightGrid.js';
import { CameraLighting } from '../../../singletons/CameraLighting.js';

function toneMap(rgb, exposure){
  const e = exposure||1; return [1-Math.exp(-e*rgb[0]), 1-Math.exp(-e*rgb[1]), 1-Math.exp(-e*rgb[2])];
}
function gammaCorrect(rgb, gamma){ const inv = 1/(gamma||2.2); return [Math.pow(rgb[0], inv), Math.pow(rgb[1], inv), Math.pow(rgb[2], inv)]; }
function luminance(rgb){ return 0.2126*rgb[0] + 0.7152*rgb[1] + 0.0722*rgb[2]; }
function rgb01ToHex(rgb){
  const r = Math.max(0, Math.min(255, (rgb[0]*255)|0));
  const g = Math.max(0, Math.min(255, (rgb[1]*255)|0));
  const b = Math.max(0, Math.min(255, (rgb[2]*255)|0));
  return '#'+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1);
}

export function wallGeometryRenderSystem(world){
  const rc = getRenderContext(world);
  if (!rc) return;

  const { ctx, W, H, cellW=16, cellH=16 } = rc;
  const cols = Math.max(1, rc.cols || Math.floor(W / cellW));
  const rows = Math.max(1, rc.rows || Math.floor(H / cellH));
  const camX = (rc.camX|0);
  const camY = (rc.camY|0);

  // Visual tuning
  const edgePx = Math.max(1, (rc.wallEdgePx|0) || 1);
  const baseWallColor = rc.wallBaseColor || '#c8c8c8';
  const seenDim = (rc.fovSeenDim != null) ? rc.fovSeenDim : 0.08;
  const outsideDim = (rc.fovOutsideDim != null) ? rc.fovOutsideDim : 0.0;

  // Lighting controls
  let lgId = 0; for (const e of world.alive){ if (world.has(e, LightGrid)) { lgId = e; break; } }
  const lg = lgId ? world.get(lgId, LightGrid) : null;
  let clId = 0; for (const e of world.alive){ if (world.has(e, CameraLighting)) { clId = e; break; } }
  const cl = clId? world.get(clId, CameraLighting) : null;
  const exposure = cl?.exposure ?? 1.0; const gamma = cl?.gamma ?? 2.2;
  const scaleX = lg && lg.w ? (lg.w / Math.max(1, cols)) : 1;
  const scaleY = lg && lg.h ? (lg.h / Math.max(1, rows)) : 1;

  // FOV masks
  const visMask = rc.visibleMask instanceof Uint8Array ? rc.visibleMask : null;
  // Pull seenMask from MapView for fog-of-war memory
  let seenMask = null, mapW = 0, mapH = 0;
  let mv = null;
  try{
    const mvId = world.mapViewId; if (mvId) mv = world.get(mvId, MapView);
    if (!mv){ for (const [_id,_mv] of world.query(MapView)){ mv = _mv; break; } }
    if (mv && (mv.w|0)>0 && (mv.h|0)>0 && (mv.seenMask instanceof Uint8Array)){
      seenMask = mv.seenMask; mapW = mv.w|0; mapH = mv.h|0;
    }
  }catch(_){ /* ignore */ }

  // Screen transform helpers
  const ox = Math.floor((W - cols * cellW) / 2);
  const oy = Math.floor((H - rows * cellH) / 2);
  const halfShiftX = (cols % 2 === 0) ? -cellW / 2 : 0;
  const halfShiftY = (rows % 2 === 0) ? -cellH / 2 : 0;

  // Viewport world bounds
  const minX = camX;
  const minY = camY;
  const maxX = camX + cols - 1;
  const maxY = camY + rows - 1;

  // Determine walls via MapView first
  const mvOpaque = (mv && typeof mv.opaqueAt === 'function') ? mv.opaqueAt : null;
  const mvTileAt = (!mvOpaque && mv && typeof mv.tileAt === 'function') ? mv.tileAt : null;
  const mvGlyphAt = (!mvOpaque && !mvTileAt && mv && typeof mv.glyphAt === 'function') ? mv.glyphAt : null;

  const wallSet = new Set(); // keys "x,y" for walls within viewport + 1 ring
  const add = (x,y)=> wallSet.add(x+','+y);
  const isWall = (x,y)=> wallSet.has(x+','+y);
  const expand = 1; // include a 1-tile border so we can detect edges at the viewport boundary
  const sx = minX - expand, ex = maxX + expand;
  const sy = minY - expand, ey = maxY + expand;

  // MapView pass
  if (mvOpaque){
    for (let y=sy; y<=ey; y++){
      for (let x=sx; x<=ex; x++){
        if (mvOpaque(x,y)) add(x,y);
      }
    }
  } else if (mvTileAt){
    for (let y=sy; y<=ey; y++){
      for (let x=sx; x<=ex; x++){
        const t = mvTileAt(x,y);
        if (t && (t.blocksLight || (t.walkable === false))) add(x,y);
      }
    }
  } else if (mvGlyphAt){
    for (let y=sy; y<=ey; y++){
      for (let x=sx; x<=ex; x++){
        const g = mvGlyphAt(x,y) || '';
        if (g === '█' || g === '#') add(x,y);
      }
    }
  }

  // Fallback: Position+Tile entities within viewport
  for (const [id, pos, tile] of world.query(Position, Tile)){
    const x = pos.x|0, y = pos.y|0;
    if (x < sx || x > ex || y < sy || y > ey) continue;
    if (tile && (tile.blocksLight || tile.walkable === false)) add(x,y);
  }

  // Helper: lighting-aware color at viewport cell (vx,vy)
  function litColorHex(vx, vy, baseHex){
    // Convert base to [r,g,b]
    let br = 0.78, bg = 0.78, bb = 0.78; // ~#c8c8c8
    if (typeof baseHex === 'string' && baseHex[0] === '#'){
      const n = parseInt(baseHex.slice(1), 16);
      br = ((n>>16)&255)/255; bg=((n>>8)&255)/255; bb=(n&255)/255;
    }
    if (lg && lg.r){
      const gx = (vx + 0.5) * scaleX;
      const gy = (vy + 0.5) * scaleY;
      const L = sampleLight(lg, gx, gy);
      const mapped = gammaCorrect(toneMap(L, exposure), gamma);
      const Lm = luminance(mapped);
      const baseTerm   = (rc.wallLightBase != null) ? rc.wallLightBase : 0.45;
      const diffuseAmt = (rc.wallLightDiffuse != null) ? rc.wallLightDiffuse : 0.65;
      const tintAmt    = (rc.wallLightTint != null) ? rc.wallLightTint : 0.25;
      const diffuse = [
        br * (baseTerm + diffuseAmt * Lm),
        bg * (baseTerm + diffuseAmt * Lm),
        bb * (baseTerm + diffuseAmt * Lm)
      ];
      const tint = [mapped[0] * tintAmt, mapped[1] * tintAmt, mapped[2] * tintAmt];
      const out = [
        Math.max(0, Math.min(1, diffuse[0] + tint[0])),
        Math.max(0, Math.min(1, diffuse[1] + tint[1])),
        Math.max(0, Math.min(1, diffuse[2] + tint[2]))
      ];
      return rgb01ToHex(out);
    }
    return baseHex || '#c8c8c8';
  }

  // Draw edges
  ctx.save();
  ctx.translate(ox + halfShiftX, oy + halfShiftY);

  for (let y=minY; y<=maxY; y++){
    for (let x=minX; x<=maxX; x++){
      if (!isWall(x,y)) continue;

      const vx = x - camX, vy = y - camY;
      // Visibility gating
      let factor = 1.0;
      let visible = true;
      if (visMask){
        visible = !!visMask[vy*cols + vx];
        if (!visible){
          // If seen, dim; else skip entirely
          if (seenMask && x>=0 && y>=0 && x<mapW && y<mapH && seenMask[y*mapW + x]) factor = seenDim;
          else factor = outsideDim;
          if (factor <= 0.001) continue;
        }
      }

      const x0 = vx * cellW;
      const y0 = vy * cellH;
      const x1 = x0 + cellW;
      const y1 = y0 + cellH;

      // Lit color per tile center
      const color = litColorHex(vx, vy, baseWallColor);
      const prevAlpha = ctx.globalAlpha;
      ctx.globalAlpha = Math.max(0, Math.min(1, factor));
      ctx.fillStyle = color;

      // Left edge
      if (!isWall(x-1, y)) ctx.fillRect(x0, y0, edgePx, cellH);
      // Right edge
      if (!isWall(x+1, y)) ctx.fillRect(x1 - edgePx, y0, edgePx, cellH);
      // Top edge
      if (!isWall(x, y-1)) ctx.fillRect(x0, y0, cellW, edgePx);
      // Bottom edge
      if (!isWall(x, y+1)) ctx.fillRect(x0, y1 - edgePx, cellW, edgePx);

      // Optional: faint interior fill to suggest solid wall without double-drawing glyphs
      if (rc.wallFillAlpha > 0){
        const a = Math.max(0, Math.min(1, rc.wallFillAlpha));
        const pa = ctx.globalAlpha; ctx.globalAlpha = pa * a;
        ctx.fillRect(x0 + edgePx, y0 + edgePx, Math.max(0, cellW - 2*edgePx), Math.max(0, cellH - 2*edgePx));
        ctx.globalAlpha = pa;
      }

      ctx.globalAlpha = prevAlpha;
    }
  }

  ctx.restore();
}
