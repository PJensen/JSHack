// SmoothLightGlowRenderer: additive, smooth halos for lights using canvas radial gradients
// Inspired by the pulsing glow demo; omits the bright core circle for subtlety.
import { RenderContext } from '../components/RenderContext.js';
import { Position } from '../components/Position.js';
import { Light } from '../components/Light.js';

function toRGB(color){
  if (!color) return [1,1,1];
  if (Array.isArray(color)) return [color[0]||0, color[1]||0, color[2]||0];
  if (typeof color === 'string'){
    const s = color.trim();
    if (s[0] === '#'){
      const n = parseInt(s.slice(1), 16);
      const r = ((n>>16)&255)/255, g=((n>>8)&255)/255, b=(n&255)/255;
      return [r,g,b];
    }
  }
  return [1,1,1];
}

function rgba(cssRgb, alpha){
  const r = Math.max(0, Math.min(255, Math.round((cssRgb[0]||0)*255)));
  const g = Math.max(0, Math.min(255, Math.round((cssRgb[1]||0)*255)));
  const b = Math.max(0, Math.min(255, Math.round((cssRgb[2]||0)*255)));
  const a = Math.max(0, Math.min(1, alpha||0));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function SmoothLightGlowRenderer(world){
  const rcId = world.renderContextId; if (!rcId) return;
  const rc = world.get(rcId, RenderContext); if (!rc) return;
  const { ctx, W, H, cellW=16, cellH=16 } = rc;
  const cols = Math.max(1, rc.cols|0), rows = Math.max(1, rc.rows|0);
  const camX = rc.camX|0, camY = rc.camY|0;

  // pixel offset to center the tile grid
  const ox = Math.floor((W - cols * cellW) / 2);
  const oy = Math.floor((H - rows * cellH) / 2);

  ctx.save();
  ctx.translate(ox, oy);
  const prevOp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';

  for (const [id, lt] of world.query(Light)){
    if (!lt.active) continue;
    const pos = world.get(id, Position);
    const lx = (lt.x != null ? lt.x : (pos?.x ?? 0));
    const ly = (lt.y != null ? lt.y : (pos?.y ?? 0));
    // Cull against viewport
    if (lx < camX-1 || ly < camY-1 || lx > camX+cols+1 || ly > camY+rows+1) continue;

    const cx = (lx - camX + 0.5) * cellW;
    const cy = (ly - camY + 0.5) * cellH;

    const basePx = Math.max(cellW, cellH);
    const radiusTiles = Math.max(0.5, lt.radius || 6);
    const radiusPx = radiusTiles * basePx * 0.95;

    const intensity = (lt.intensityEff != null ? lt.intensityEff : (lt.intensity || 1));
    // Gentle flicker/pulse already baked into intensityEff by FlickerSystem when present.
    const rgb = toRGB(lt.color);

    // Layer 1: wide, soft halo
    let grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radiusPx);
    grad.addColorStop(0.0, rgba([rgb[0]*0.47, rgb[1]*0.78, rgb[2]*1.0], 0.20 * intensity));
    grad.addColorStop(0.6, rgba([rgb[0]*0.2, rgb[1]*0.47, rgb[2]*1.0], 0.08 * intensity));
    grad.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, radiusPx, 0, Math.PI*2); ctx.fill();

    // Layer 2: tighter bloom without hot core
    grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radiusPx * 0.55);
    grad.addColorStop(0.0, rgba([rgb[0]*0.7, rgb[1]*0.9, rgb[2]*1.0], 0.35 * intensity));
    grad.addColorStop(0.7, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, radiusPx * 0.55, 0, Math.PI*2); ctx.fill();
  }

  ctx.globalCompositeOperation = prevOp;
  ctx.restore();
}
