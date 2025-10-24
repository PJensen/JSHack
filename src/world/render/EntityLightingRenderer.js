// EntityLightingRenderer: shade glyphs using LightGrid diffuse+specular
import { RenderContext } from '../components/RenderContext.js';
import { Position } from '../components/Position.js';
import { Glyph } from '../components/Glyph.js';
import { Material } from '../components/Material.js';
import { LightProbe } from '../components/LightProbe.js';
import { LightGrid, sampleLight } from '../singletons/LightGrid.js';
import { CameraLighting } from '../singletons/CameraLighting.js';

function toneMap(rgb, exposure){
  const e = exposure||1; return [1-Math.exp(-e*rgb[0]), 1-Math.exp(-e*rgb[1]), 1-Math.exp(-e*rgb[2])];
}
function gammaCorrect(rgb, gamma){ const inv = 1/(gamma||2.2); return [Math.pow(rgb[0], inv), Math.pow(rgb[1], inv), Math.pow(rgb[2], inv)]; }
function toHex(rgb){ const r=(rgb[0]*255)|0, g=(rgb[1]*255)|0, b=(rgb[2]*255)|0; return '#'+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1); }
function normalize(v){ const l=Math.hypot(v[0],v[1])||1; return [v[0]/l,v[1]/l]; }
function mix(a,b,t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }

export function EntityLightingRenderer(world){
  // return;
  const rcId = world.renderContextId; if (!rcId) return; const rc = world.get(rcId, RenderContext); if (!rc) return;
  const { ctx, W, H, cellW=16, cellH=16, font } = rc;
  const cols = Math.max(1, rc.cols|0), rows = Math.max(1, rc.rows|0);
  const camX = rc.camX|0, camY = rc.camY|0;

  let lgId = 0; for (const e of world.alive){ if (world.has(e, LightGrid)) { lgId = e; break; } }
  if (!lgId) return; const lg = world.get(lgId, LightGrid); if (!lg || !lg.r) return;
  let clId = 0; for (const e of world.alive){ if (world.has(e, CameraLighting)) { clId = e; break; } }
  const cl = clId? world.get(clId, CameraLighting) : null;
  const exposure = cl?.exposure ?? 1.0; const gamma = cl?.gamma ?? 2.2;
  const scaleX = lg.w / cols; const scaleY = lg.h / rows;

  // center camera grid like tile renderer (apply half-cell shift for even viewports)
  const ox = Math.floor((W - cols * cellW) / 2);
  const oy = Math.floor((H - rows * cellH) / 2);
  const halfShiftX = (cols % 2 === 0) ? -cellW / 2 : 0;
  const halfShiftY = (rows % 2 === 0) ? -cellH / 2 : 0;
  ctx.save(); ctx.translate(ox + halfShiftX, oy + halfShiftY);
  // Multiply so lighting modulates existing glyphs drawn by base renderers
  const prevOp = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'multiply';
  ctx.font = font || '18px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  // Optional FOV weights from RenderContext for smooth dimming near sight edges
  const visW = (rc && rc.visibleWeight instanceof Float32Array) ? rc.visibleWeight : null;
  const vis = (!visW && rc && rc.visibleMask instanceof Uint8Array) ? rc.visibleMask : null;
  const outsideDim = 0.2;

  for (const [id, pos, glyph] of world.query(Position, Glyph)){
    const mx = Math.floor((pos.x - camX));
    const my = Math.floor((pos.y - camY));
    if (mx < 0 || my < 0 || mx >= cols || my >= rows) continue;

    const m = world.get(id, Material) || { albedo:[1,1,1], roughness:0.8, metalness:0, specular:0.2 };
    const probe = world.get(id, LightProbe) || null;

    const gx = (mx + 0.5) * scaleX, gy = (my + 0.5) * scaleY;
    const L = sampleLight(lg, gx, gy);

    // approximate light direction by gradient sampling around (gx,gy)
    const d = 1.0;
    const Lx = sampleLight(lg, gx + d, gy);
    const Ly = sampleLight(lg, gx, gy + d);
    const Lm  = 0.2126*L[0]+0.7152*L[1]+0.0722*L[2];
    const Lmx = 0.2126*Lx[0]+0.7152*Lx[1]+0.0722*Lx[2];
    const Lmy = 0.2126*Ly[0]+0.7152*Ly[1]+0.0722*Ly[2];
    let Ldir = normalize([Lmx - Lm, Lmy - Lm]);

    const N = normalize(probe?.normal2D || [0,1]);
    const V = normalize([0,1]); // view from above camera
    const Hn = normalize([Ldir[0] + V[0], Ldir[1] + V[1]]);
    const diff = Math.max(0, N[0]*Ldir[0] + N[1]*Ldir[1]);
    const shininess = 8 + (96 - 8) * (1 - (m.roughness ?? 0.8));
    const specPow = Math.pow(Math.max(0, N[0]*Hn[0] + N[1]*Hn[1]), shininess);
    const specTint = mix([1,1,1], m.albedo || [1,1,1], m.metalness ?? 0);

    let rgb = [
      (m.albedo[0] || 1)*diff*L[0] + specTint[0]*specPow*L[0]*(m.specular ?? 0.2),
      (m.albedo[1] || 1)*diff*L[1] + specTint[1]*specPow*L[1]*(m.specular ?? 0.2),
      (m.albedo[2] || 1)*diff*L[2] + specTint[2]*specPow*L[2]*(m.specular ?? 0.2)
    ];

    let mapped = gammaCorrect(toneMap(rgb, exposure), gamma);
    // Apply smooth FOV fade to glyph
    let factor = 1;
    if (visW){
      const idx = my*cols + mx; const w = visW[idx] || 0;
      factor = outsideDim + (1 - outsideDim) * Math.max(0, Math.min(1, w));
    } else if (vis){
      const idx = my*cols + mx; factor = vis[idx] ? 1 : outsideDim;
    }
    mapped = [mapped[0]*factor, mapped[1]*factor, mapped[2]*factor];
    ctx.fillStyle = toHex(mapped);
  const ch = (glyph.char || '@');
  ctx.fillText(ch, mx*cellW + cellW*0.5, my*cellH + cellH*0.5);
  }

  ctx.globalCompositeOperation = prevOp; ctx.restore();
}
