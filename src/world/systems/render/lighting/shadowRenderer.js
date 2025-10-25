// Shadow Render System: draws per-light drop shadows for glyph entities
import { RenderContext } from '../../../components/RenderContext.js';
import { Position } from '../../../components/Position.js';
import { Glyph } from '../../../components/Glyph.js';
import { Player } from '../../../components/Player.js';
import { Gold } from '../../../components/Gold.js';
import { Light } from '../../../components/Light.js';

function getViewport(rc){
  const cols = Math.max(1, rc.cols|0), rows = Math.max(1, rc.rows|0);
  const camX = rc.camX|0, camY = rc.camY|0;
  const cellW = rc.cellW||16, cellH = rc.cellH||16;
  const W = rc.W|0, H = rc.H|0;
  const ox = Math.floor((W - cols * cellW) / 2);
  const oy = Math.floor((H - rows * cellH) / 2);
  return { cols, rows, camX, camY, cellW, cellH, W, H, ox, oy };
}

export function shadowRenderSystem(world){
  const rcId = world.renderContextId; if (!rcId) return;
  const rc = world.get(rcId, RenderContext); if (!rc) return;
  const { ctx, font } = rc;
  const { cols, rows, camX, camY, cellW, cellH, W, H, ox, oy } = getViewport(rc);
  const halfShiftX = (cols % 2 === 0) ? -cellW / 2 : 0;
  const halfShiftY = (rows % 2 === 0) ? -cellH / 2 : 0;

  // FOV gating (optional): modulate shadow alpha based on visibility at entity tile
  const visW = (rc.visibleWeight instanceof Float32Array && rc.visibleWeight.length === cols*rows) ? rc.visibleWeight : null;
  const vis = (!visW && rc.visibleMask instanceof Uint8Array && rc.visibleMask.length === cols*rows) ? rc.visibleMask : null;
  const outsideDim = 0.2;

  const lights = [];
  const cx = ox + halfShiftX + cols * cellW * 0.5;
  const cy = oy + halfShiftY + rows * cellH * 0.5;
  for (const [lid, lt] of world.query(Light)){
    if (lt && lt.active === false) continue;
    const pos = world.get(lid, Position) || { x: lt.x ?? 0, y: lt.y ?? 0 };
    const lx = (lt.x != null ? lt.x : pos.x|0);
    const ly = (lt.y != null ? lt.y : pos.y|0);
    if (lx < camX-4 || ly < camY-4 || lx > camX+cols+4 || ly > camY+rows+4) continue;
    const intensity = (lt.intensityEff != null ? lt.intensityEff : (lt.intensity || 1));
    const radius = Math.max(0.5, lt.radius || 6);
    const slx = ox + halfShiftX + (lx - camX + 0.5) * cellW;
    const sly = oy + halfShiftY + (ly - camY + 0.5) * cellH;
    const d2 = (slx - cx)*(slx - cx) + (sly - cy)*(sly - cy);
    lights.push({ x: lx, y: ly, intensity, radius, slx, sly, d2 });
  }
  if (lights.length === 0) return;
  const maxLights = Math.max(1, rc.shadowMaxLights ?? 2);
  lights.sort((a,b)=> a.d2 - b.d2);
  const useLights = lights.slice(0, maxLights);

  const shadowAlpha = rc.shadowAlpha ?? 0.42;
  const shadowScale = rc.shadowOffsetScale ?? 0.85;
  const maxPx = rc.shadowMaxPx ?? Math.max(cellW, cellH) * 1.35;
  const softPass = rc.shadowSoftPass ?? true;
  const maxEntitiesPerFrame = Math.max(1, rc.shadowMaxEntitiesPerFrame ?? 80);
  const fallbackRadius = Math.max(cols, rows) * 0.5;
  const maxDistTiles = Math.max(1, rc.shadowMaxDistanceTiles ?? Math.floor(fallbackRadius));

  ctx.save();
  ctx.font = font || '18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(1, shadowAlpha))})`;

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
  rc.shadowRRIndex = (start + count) % Math.max(1, n);

  for (let j=0;j<count;j++){
    const i = (start + j) % n;
    const [eid, pos, glyph] = ents[i];
    if (glyph.char == null) continue;

    const tx = pos.x - camX + 0.5;
    const ty = pos.y - camY + 0.5;
    if (tx < -1 || ty < -1 || tx > cols+1 || ty > rows+1) continue;

    const sx = ox + halfShiftX + tx * cellW;
    const sy = oy + halfShiftY + ty * cellH;

    for (const l of useLights){
      const dxT = (pos.x - l.x);
      const dyT = (pos.y - l.y);
      const dTiles = Math.hypot(dxT, dyT);
      if (dTiles > maxDistTiles) continue;
      const lx = l.slx;
      const ly = l.sly;
      let dx = sx - lx;
      let dy = sy - ly;
      const dist = Math.hypot(dx, dy) || 1;
      dx /= dist; dy /= dist;
      const cellAvg = (cellW + cellH) * 0.5;
      const basePx = shadowScale * cellAvg;
      const intensityFactor = 0.7 + 0.3 * Math.min(2, Math.max(0, l.intensity));
      const distFactor = 1 / (1 + (dist / (cellAvg * 3)));
      let offPx = Math.min(maxPx, Math.max(0.1 * cellAvg, basePx * intensityFactor * distFactor));

      const oxPx = dx * offPx;
      const oyPx = dy * offPx;

      const ch = glyph.char;
      // Adjust shadow alpha by FOV visibility at the entity's tile
      let alpha = shadowAlpha;
      const mx = (pos.x - camX) | 0; const my = (pos.y - camY) | 0;
      if (mx>=0 && my>=0 && mx<cols && my<rows){
        if (visW){ const w = visW[my*cols + mx] || 0; alpha *= outsideDim + (1 - outsideDim) * Math.max(0, Math.min(1, w)); }
        else if (vis){ alpha *= (vis[my*cols + mx] ? 1 : outsideDim); }
      }

      const prevFill = ctx.fillStyle;
      ctx.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(1, alpha))})`;
      ctx.fillText(ch, sx + oxPx, sy + oyPx);
      if (softPass) {
        ctx.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(1, alpha * 0.45))})`;
        ctx.fillText(ch, sx + oxPx * 0.92, sy + oyPx * 0.92);
      }
      ctx.fillStyle = prevFill;
    }
  }

  ctx.restore();
}
