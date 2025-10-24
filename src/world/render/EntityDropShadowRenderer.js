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

  // Gather active lights within/near the viewport
  const lights = [];
  for (const [lid, lt] of world.query(Light)){
    if (lt && lt.active === false) continue;
    const pos = world.get(lid, Position) || { x: lt.x ?? 0, y: lt.y ?? 0 };
    const lx = (lt.x != null ? lt.x : pos.x|0);
    const ly = (lt.y != null ? lt.y : pos.y|0);
    // cull lights far from viewport for perf
    if (lx < camX-4 || ly < camY-4 || lx > camX+cols+4 || ly > camY+rows+4) continue;
    const intensity = (lt.intensityEff != null ? lt.intensityEff : (lt.intensity || 1));
    const radius = Math.max(0.5, lt.radius || 6);
    lights.push({ x: lx, y: ly, intensity, radius });
  }
  if (lights.length === 0) return;

  // Shadow tuning (can be overridden via RenderContext)
  const shadowAlpha = rc.shadowAlpha ?? 0.42;
  const shadowScale = rc.shadowOffsetScale ?? 0.85; // how long the offset is in cells before distance scaling
  const maxPx = rc.shadowMaxPx ?? Math.max(cellW, cellH) * 1.35;
  const blurScale = rc.shadowBlurScale ?? 0.35; // how much blur per (intensity * radius)
  const maxBlurPx = rc.shadowMaxBlurPx ?? Math.max(cellW, cellH) * 0.9;

  ctx.save();
  ctx.font = font || '18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(1, shadowAlpha))})`;

  // Render shadows for player and items (exclude tiles/walls)
  for (const [eid, pos, glyph] of world.query(Position, Glyph)){
    // Skip non-targets if you want only player/items: require Player or Gold
    const isPlayer = world.has(eid, Player);
    const isGold = world.has(eid, Gold);
    if (!isPlayer && !isGold) continue;

    const tx = pos.x - camX + 0.5;
    const ty = pos.y - camY + 0.5;
    // Cull offscreen
    if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) continue;

    const sx = ox + tx * cellW;
    const sy = oy + ty * cellH;

    // For each light, draw a shadow copy offset away from the light
    for (const l of lights){
      const lx = ox + (l.x - camX + 0.5) * cellW;
      const ly = oy + (l.y - camY + 0.5) * cellH;
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

      // Blur amount scales with light strength and radius (stylized softness)
      const blurPx = Math.min(maxBlurPx, Math.max(0, blurScale * l.radius * intensityFactor * (cellAvg / 16)));

      // draw the shadow glyph at offset position with optional blur
      // keep alpha low; draw blurred pass then a faint core for contact
      const ch = glyph.char || '@';
      const prevFill = ctx.fillStyle;
      const prevFilter = ctx.filter;
      ctx.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(1, shadowAlpha))})`;
      if (blurPx > 0.25) {
        ctx.filter = `blur(${blurPx.toFixed(2)}px)`;
        ctx.fillText(ch, sx + oxPx, sy + oyPx);
        // subtle core for crisper look
        ctx.filter = 'none';
        ctx.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(1, shadowAlpha * 0.5))})`;
        ctx.fillText(ch, sx + oxPx * 0.94, sy + oyPx * 0.94);
      } else {
        ctx.filter = 'none';
        ctx.fillText(ch, sx + oxPx, sy + oyPx);
      }
      ctx.filter = prevFilter;
      ctx.fillStyle = prevFill;
    }
  }

  ctx.restore();
}
