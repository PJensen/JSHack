// EntityDropShadowRenderer: draws one shadow per light per entity glyph (e.g., '@', '$')
// Shadows are offset away from each light, scaled by distance and intensity.
import { RenderContext } from '../components/RenderContext.js';
import { Position } from '../components/Position.js';
import { Glyph } from '../components/Glyph.js';
import { Player } from '../components/Player.js';
import { Gold } from '../components/Gold.js';
import { Light } from '../components/Light.js';

function getViewport(rc){
  const cols = Math.max(1, rc.cols|0), rows = Math.max(1, rc.rows|0);
  const camX = rc.camX|0, camY = rc.camY|0;
  const cellW = rc.cellW||16, cellH = rc.cellH||16;
  const W = rc.W|0, H = rc.H|0;
  const ox = Math.floor((W - cols * cellW) / 2);
  const oy = Math.floor((H - rows * cellH) / 2);
  return { cols, rows, camX, camY, cellW, cellH, W, H, ox, oy };
}

export function EntityDropShadowRenderer(world){
  const rcId = world.renderContextId; if (!rcId) return;
  const rc = world.get(rcId, RenderContext); if (!rc) return;
  const { ctx, font } = rc;
  const { cols, rows, camX, camY, cellW, cellH, W, H, ox, oy } = getViewport(rc);
  // Match tile/lighting renderers: apply half-cell shift for even viewport sizes
  const halfShiftX = (cols % 2 === 0) ? -cellW / 2 : 0;
  const halfShiftY = (rows % 2 === 0) ? -cellH / 2 : 0;

  // Gather active lights within/near the viewport
  const lights = [];
  // Screen center in our local transform
  const cx = ox + halfShiftX + cols * cellW * 0.5;
  const cy = oy + halfShiftY + rows * cellH * 0.5;
  for (const [lid, lt] of world.query(Light)){
    if (lt && lt.active === false) continue;
    const pos = world.get(lid, Position) || { x: lt.x ?? 0, y: lt.y ?? 0 };
    const lx = (lt.x != null ? lt.x : pos.x|0);
    const ly = (lt.y != null ? lt.y : pos.y|0);
    // cull lights far from viewport for perf
    if (lx < camX-4 || ly < camY-4 || lx > camX+cols+4 || ly > camY+rows+4) continue;
    const intensity = (lt.intensityEff != null ? lt.intensityEff : (lt.intensity || 1));
    const radius = Math.max(0.5, lt.radius || 6);
    // Precompute screen coords and camera-center distance for sorting
    const slx = ox + halfShiftX + (lx - camX + 0.5) * cellW;
    const sly = oy + halfShiftY + (ly - camY + 0.5) * cellH;
    const d2 = (slx - cx)*(slx - cx) + (sly - cy)*(sly - cy);
    lights.push({ x: lx, y: ly, intensity, radius, slx, sly, d2 });
  }
  if (lights.length === 0) return;
  // Sort lights by proximity to camera center and keep only a few for perf
  const maxLights = Math.max(1, rc.shadowMaxLights ?? 2);
  lights.sort((a,b)=> a.d2 - b.d2);
  const useLights = lights.slice(0, maxLights);

  // Shadow tuning (can be overridden via RenderContext)
  const shadowAlpha = rc.shadowAlpha ?? 0.42;
  const shadowScale = rc.shadowOffsetScale ?? 0.85; // how long the offset is in cells before distance scaling
  const maxPx = rc.shadowMaxPx ?? Math.max(cellW, cellH) * 1.35;
  const softPass = rc.shadowSoftPass ?? true; // draw a faint second pass for faux softness
  const maxEntitiesPerFrame = Math.max(1, rc.shadowMaxEntitiesPerFrame ?? 80);
  // Distance cutoff (in tiles). Prefer explicit config; else derive ~FOV radius (half the larger axis)
  const fallbackRadius = Math.max(cols, rows) * 0.5;
  const maxDistTiles = Math.max(1, rc.shadowMaxDistanceTiles ?? Math.floor(fallbackRadius));

  ctx.save();
  ctx.font = font || '18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(1, shadowAlpha))})`;

  // Build list of eligible entities (player/items only) and apply round-robin cap
  const ents = [];
  for (const [eid, pos, glyph] of world.query(Position, Glyph)){
    if (!world.has(eid, Player) && !world.has(eid, Gold)) continue;
    ents.push([eid, pos, glyph]);
  }
  const n = ents.length;
  if (n === 0) { ctx.restore?.(); return; }
  let start = (rc.shadowRRIndex|0) % n;
  if (start < 0) start = 0;
  const count = Math.min(n, maxEntitiesPerFrame);
  // Advance index for next frame (store back on rc)
  rc.shadowRRIndex = (start + count) % Math.max(1, n);

  // Render shadows for selected entities
  for (let j=0;j<count;j++){
    const i = (start + j) % n;
    const [eid, pos, glyph] = ents[i];
    if (glyph.char == null) continue;

    const tx = pos.x - camX + 0.5;
    const ty = pos.y - camY + 0.5;
    // Cull offscreen
    if (tx < -1 || ty < -1 || tx > cols+1 || ty > rows+1) continue;

    const sx = ox + halfShiftX + tx * cellW;
    const sy = oy + halfShiftY + ty * cellH;

    // For each light, draw a shadow copy offset away from the light if within max distance
    for (const l of useLights){
      // Distance in tiles between entity and light
      const dxT = (pos.x - l.x);
      const dyT = (pos.y - l.y);
      const dTiles = Math.hypot(dxT, dyT);
      if (dTiles > maxDistTiles) continue;
      const lx = l.slx;
      const ly = l.sly;
      let dx = sx - lx;
      let dy = sy - ly;
      const dist = Math.hypot(dx, dy) || 1;
      // Normalize direction away from light
      dx /= dist; dy /= dist;
      // Base offset in pixels, primarily driven by light intensity and light radius
      const cellAvg = (cellW + cellH) * 0.5;
      const basePx = shadowScale * cellAvg;
      const intensityFactor = 0.7 + 0.3 * Math.min(2, Math.max(0, l.intensity));
      // Slight distance attenuation so very far lights cast subtler offsets
      const distFactor = 1 / (1 + (dist / (cellAvg * 3))); // ~1 close, ~0.25 at ~3 cells
      let offPx = Math.min(maxPx, Math.max(0.1 * cellAvg, basePx * intensityFactor * distFactor));

      const oxPx = dx * offPx;
      const oyPx = dy * offPx;

      // draw the shadow glyph at offset position with a cheap two-tap softness
      const ch = glyph.char;
      const prevFill = ctx.fillStyle;
      ctx.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(1, shadowAlpha))})`;
      ctx.fillText(ch, sx + oxPx, sy + oyPx);
      if (softPass) {
        ctx.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(1, shadowAlpha * 0.45))})`;
        ctx.fillText(ch, sx + oxPx * 0.92, sy + oyPx * 0.92);
      }
      ctx.fillStyle = prevFill;
    }
  }

  ctx.restore();
}
