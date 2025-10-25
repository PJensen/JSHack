// Tile Lighting Render System: shades tiles using LightGrid diffuse
import { RenderContext } from '../../../components/RenderContext.js';
import { LightGrid, sampleLight } from '../../../singletons/LightGrid.js';
import { MapView } from '../../../components/MapView.js';
import { CameraLighting } from '../../../singletons/CameraLighting.js';

function toneMap(rgb, exposure){
  const e = exposure||1;
  return [1-Math.exp(-e*rgb[0]), 1-Math.exp(-e*rgb[1]), 1-Math.exp(-e*rgb[2])];
}
function gammaCorrect(rgb, gamma){
  const inv = 1/(gamma||2.2);
  return [Math.pow(rgb[0], inv), Math.pow(rgb[1], inv), Math.pow(rgb[2], inv)];
}
function toHex(rgb){
  const r = Math.max(0, Math.min(255, (rgb[0]*255)|0));
  const g = Math.max(0, Math.min(255, (rgb[1]*255)|0));
  const b = Math.max(0, Math.min(255, (rgb[2]*255)|0));
  return '#'+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1);
}

export function tileLightingRenderSystem(world){
  const rcId = world.renderContextId; if (!rcId) return;
  const rc = world.get(rcId, RenderContext); if (!rc) return;
  const { ctx, W, H, cellW=16, cellH=16 } = rc;
  const cols = Math.max(1, rc.cols|0), rows = Math.max(1, rc.rows|0);

  let lgId = 0; for (const e of world.alive){ if (world.has(e, LightGrid)) { lgId = e; break; } }
  if (!lgId) return; const lg = world.get(lgId, LightGrid);
  if (!lg || !lg.r) return;

  let clId = 0; for (const e of world.alive){ if (world.has(e, CameraLighting)) { clId = e; break; } }
  const cl = clId? world.get(clId, CameraLighting) : null;
  const exposure = cl?.exposure ?? 1.0; const gamma = cl?.gamma ?? 2.2;

  const scaleX = lg.w / cols; const scaleY = lg.h / rows;
  // Optional fog-of-war memory from MapView
  let seenMask = null, mapW = 0, mapH = 0;
  try{
    let mv = null; const mvId = world.mapViewId;
    if (mvId) mv = world.get(mvId, MapView);
    if (!mv){ for (const [_id,_mv] of world.query(MapView)){ mv = _mv; break; } }
    if (mv && (mv.w|0)>0 && (mv.h|0)>0 && (mv.seenMask instanceof Uint8Array)){
      seenMask = mv.seenMask; mapW = mv.w|0; mapH = mv.h|0;
    }
  }catch(_){ /* ignore */ }
  const seenDim = (rc.fovSeenDim != null) ? rc.fovSeenDim : 0.08;
  const seenBlurPx = (rc.fogSeenBlurPx != null) ? rc.fogSeenBlurPx : 0.0;

  ctx.save();
  const ox = Math.floor((W - cols * cellW) / 2);
  const oy = Math.floor((H - rows * cellH) / 2);
  ctx.translate(ox, oy);
  const visW = (rc.visibleWeight instanceof Float32Array && rc.visibleWeight.length === cols*rows) ? rc.visibleWeight : null;
  const vis = (!visW && rc.visibleMask instanceof Uint8Array && rc.visibleMask.length === cols*rows) ? rc.visibleMask : null;
  // Outside-FOV dim factor: default to 0 (fully hide light outside FOV); can be overridden via RenderContext.fovOutsideDim
  const outsideDim = (rc.fovOutsideDim != null) ? rc.fovOutsideDim : 0.0;
  for (let y=0;y<rows;y++){
    for (let x=0;x<cols;x++){
      const gx = (x + 0.5) * scaleX;
      const gy = (y + 0.5) * scaleY;
      const L = sampleLight(lg, gx, gy);
      const mapped = gammaCorrect(toneMap(L, exposure), gamma);
      let factor = 1;
      let seenOnly = false;
      const idx = y*cols + x;
      if (visW){
        const w = visW[idx];
        factor = outsideDim + (1 - outsideDim) * Math.max(0, Math.min(1, w));
        if (w <= 0.001 && seenMask){
          const mx = (rc.camX|0) + x; const my = (rc.camY|0) + y;
          if (mx>=0 && my>=0 && mx<mapW && my<mapH && seenMask[my*mapW + mx]) { factor = seenDim; seenOnly = true; }
        }
      } else if (vis){
        const v = vis[idx] ? 1 : 0;
        if (v){ factor = 1; }
        else if (seenMask){
          const mx = (rc.camX|0) + x; const my = (rc.camY|0) + y;
          if (mx>=0 && my>=0 && mx<mapW && my<mapH && seenMask[my*mapW + mx]) { factor = seenDim; seenOnly = true; }
          else { factor = outsideDim; }
        } else {
          factor = outsideDim;
        }
      }
      ctx.fillStyle = toHex([mapped[0]*factor, mapped[1]*factor, mapped[2]*factor]);
      const prevF = ctx.filter || 'none';
      if (seenOnly && seenBlurPx > 0) ctx.filter = `blur(${seenBlurPx}px)`;
      ctx.fillRect(x*cellW, y*cellH, cellW, cellH);
      if (seenOnly && seenBlurPx > 0) ctx.filter = prevF;
    }
  }
  ctx.restore();
}
