// TileLightingRenderer: smooth full-screen lighting overlay (no blocky tiles)
import { RenderContext } from '../components/RenderContext.js';
import { LightGrid } from '../singletons/LightGrid.js';
import { CameraLighting } from '../singletons/CameraLighting.js';

function toneMap(rgb, exposure){
  const e = exposure||1; return [1-Math.exp(-e*rgb[0]), 1-Math.exp(-e*rgb[1]), 1-Math.exp(-e*rgb[2])];
}
function gammaCorrect(rgb, gamma){ const inv = 1/(gamma||2.2); return [Math.pow(rgb[0], inv), Math.pow(rgb[1], inv), Math.pow(rgb[2], inv)]; }

const overlayCache = new WeakMap(); // rc -> { cvs, ictx, w, h }

export function TileLightingRenderer(world){
  const rcId = world.renderContextId; if (!rcId) return; const rc = world.get(rcId, RenderContext); if (!rc) return;
  const { ctx, W, H, cellW=16, cellH=16 } = rc;
  const cols = Math.max(1, rc.cols|0), rows = Math.max(1, rc.rows|0);

  let lgId = 0; for (const e of world.alive){ if (world.has(e, LightGrid)) { lgId = e; break; } }
  if (!lgId) return; const lg = world.get(lgId, LightGrid); if (!lg || !lg.r) return;
  let clId = 0; for (const e of world.alive){ if (world.has(e, CameraLighting)) { clId = e; break; } }
  const cl = clId? world.get(clId, CameraLighting) : null;
  const exposure = cl?.exposure ?? 1.0; const gamma = cl?.gamma ?? 2.2;

  // Prepare/update offscreen overlay canvas at LightGrid resolution
  let entry = overlayCache.get(rc);
  if (!entry || entry.w !== lg.w || entry.h !== lg.h){
    const cvs = document.createElement('canvas');
    cvs.width = lg.w; cvs.height = lg.h;
    const ictx = cvs.getContext('2d');
    overlayCache.set(rc, entry = { cvs, ictx, w: lg.w, h: lg.h });
  }
  const { cvs, ictx } = entry;

  // Rasterize LightGrid to the offscreen image (tone-map + gamma)
  const img = ictx.createImageData(lg.w, lg.h);
  const data = img.data; const n = lg.w * lg.h;
  for (let i=0;i<n;i++){
    const tm = toneMap([lg.r[i], lg.g[i], lg.b[i]], exposure);
    const gc = gammaCorrect(tm, gamma);
    const o = i*4;
    data[o  ] = Math.max(0, Math.min(255, (gc[0]*255)|0));
    data[o+1] = Math.max(0, Math.min(255, (gc[1]*255)|0));
    data[o+2] = Math.max(0, Math.min(255, (gc[2]*255)|0));
    data[o+3] = 255;
  }
  ictx.putImageData(img, 0, 0);

  // Draw smoothly upscaled onto the visible tile area, using multiply to modulate
  const ox = Math.floor((W - cols * cellW) / 2);
  const oy = Math.floor((H - rows * cellH) / 2);
  ctx.save();
  const prevS = ctx.imageSmoothingEnabled; const prevOp = ctx.globalCompositeOperation;
  ctx.imageSmoothingEnabled = true;
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(cvs, 0, 0, cvs.width, cvs.height, ox, oy, cols*cellW, rows*cellH);
  ctx.globalCompositeOperation = prevOp; ctx.imageSmoothingEnabled = prevS;
  ctx.restore();
}
