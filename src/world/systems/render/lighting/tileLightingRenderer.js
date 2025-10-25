// Tile Lighting Render System: shades tiles using LightGrid diffuse
import { RenderContext } from '../../../components/RenderContext.js';
import { LightGrid, sampleLight } from '../../../singletons/LightGrid.js';
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
      if (visW){
        const w = visW[y*cols + x];
        factor = outsideDim + (1 - outsideDim) * Math.max(0, Math.min(1, w));
      } else if (vis){
        factor = vis[y*cols + x] ? 1 : outsideDim;
      }
      ctx.fillStyle = toHex([mapped[0]*factor, mapped[1]*factor, mapped[2]*factor]);
      ctx.fillRect(x*cellW, y*cellH, cellW, cellH);
    }
  }
  ctx.restore();
}
