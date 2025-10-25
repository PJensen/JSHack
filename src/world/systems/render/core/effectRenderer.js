// Effect Render System
// Renders effect glyphs (e.g., float text) and pooled particles
// READONLY: performs no mutations — only reads world state and draws to canvas
import { getRenderContext } from '../utils.js';
import { Effect } from '../../../components/Effect.js';
import { getGlobalParticlePool } from '../../../effects/particlePool.js';

export function effectRenderSystem(world) {
  const rc = getRenderContext(world);
  if (!rc) return;
  const { ctx, W, H, cellW, cellH, cols = 0, rows = 0 } = rc;

  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  const ox = Math.floor((W - (cols * cellW)) / 2);
  const oy = Math.floor((H - (rows * cellH)) / 2);

  // FOV gating: effects and particles are hidden outside current FOV
  const visW = (rc.visibleWeight instanceof Float32Array && rc.visibleWeight.length === cols*rows) ? rc.visibleWeight : null;
  const vis = (!visW && rc.visibleMask instanceof Uint8Array && rc.visibleMask.length === cols*rows) ? rc.visibleMask : null;

  for (const [id, eff] of world.query(Effect)) {
    if (!eff.type) continue;
    if (eff.type === 'float_text') {
      const d = eff.data || {};
      const pos = eff.pos || d.pos || { x: 0, y: 0 };
      const sx = ox + (pos.x - (rc.camX || 0)) * cellW + cellW / 2;
      const sy = oy + (pos.y - (rc.camY || 0)) * cellH + cellH / 2;
      if (sx < -40 || sy < -40 || sx > W + 40 || sy > H + 40) continue;

  // Skip if not in visible FOV
  const vx = (pos.x - (rc.camX||0))|0; const vy = (pos.y - (rc.camY||0))|0;
  if (visW){ const w = visW[(vy*cols + vx) | 0] || 0; if (w <= 0.02) continue; }
  else if (vis){ if (!vis[(vy*cols + vx) | 0]) continue; }

  const ttl = eff.ttl || 0;
      const ttlMax = eff.ttlMax || 1;
      const lin = Math.max(0, ttl / ttlMax);
      const alpha = lin * lin;
      const t = 1 - lin;

      const scaleStart = (d.scaleStart !== undefined) ? d.scaleStart : 1.0;
      const scaleEnd = (d.scaleEnd !== undefined) ? d.scaleEnd : 0.75;
      const scale = scaleStart + (scaleEnd - scaleStart) * t;

      const fontPx = Math.max(10, Math.round((cellH - 8) * scale));
      ctx.globalAlpha = alpha;
      ctx.font = `${fontPx}px monospace`;
      ctx.fillStyle = d.color || '#ffffff';
      ctx.fillText(d.text || '', sx, sy);
      ctx.globalAlpha = 1.0;
    }
  }

  const particlePool = getGlobalParticlePool();
  if (particlePool && particlePool.count > 0) {
    particlePool.forEach(p => {
      if (!p.alive) return;
      const sx = ox + (p.x - (rc.camX || 0)) * cellW + cellW / 2;
      const sy = oy + (p.y - (rc.camY || 0)) * cellH + cellH / 2;
      if (sx < -40 || sy < -40 || sx > W + 40 || sy > H + 40) return;

  // Skip if not in visible FOV (use particle tile position)
  const vx = (p.x - (rc.camX||0))|0; const vy = (p.y - (rc.camY||0))|0;
  if (visW){ const w = visW[(vy*cols + vx) | 0] || 0; if (w <= 0.02) return; }
  else if (vis){ if (!vis[(vy*cols + vx) | 0]) return; }

  const lifeRatio = Math.max(0, Math.min(1, p.life / p.lifeMax));
      const progress = 1 - lifeRatio;
      const currentSize = p.size + (p.sizeEnd - p.size) * progress;
      const pixelSize = Math.max(1, Math.round(currentSize * cellH * 0.5));
      const alpha = lifeRatio * (p.alpha || 1.0);
      const hasRotation = p.rotation !== 0 || p.rotationSpeed !== 0;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color || '#ffffff';

      if (hasRotation) {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(p.rotation);
        ctx.fillRect(-pixelSize / 2, -pixelSize / 2, pixelSize, pixelSize);
        ctx.restore();
      } else {
        ctx.fillRect(
          Math.round(sx - pixelSize / 2),
          Math.round(sy - pixelSize / 2),
          pixelSize,
          pixelSize
        );
      }

      ctx.globalAlpha = 1.0;
    });
  }

  // Legacy particleSystem support if attached to RenderContext
  const ps = rc.particleSystem || null;
  if (ps) {
    ps.forEach(p => {
      if (!p.alive) return;
      const sx = ox + (p.x - (rc.camX || 0)) * cellW + cellW / 2;
      const sy = oy + (p.y - (rc.camY || 0)) * cellH + cellH / 2;
      if (sx < -40 || sy < -40 || sx > W + 40 || sy > H + 40) return;

  // Skip if not in visible FOV
  const vx2 = (p.x - (rc.camX||0))|0; const vy2 = (p.y - (rc.camY||0))|0;
  if (visW){ const w2 = visW[(vy2*cols + vx2) | 0] || 0; if (w2 <= 0.02) return; }
  else if (vis){ if (!vis[(vy2*cols + vx2) | 0]) return; }

  const life = Math.max(0, p.life || 0);
      const lifeMax = p.lifeMax || 1;
      const t = 1 - (life / lifeMax);
      const alpha = Math.max(0, Math.min(1, life / lifeMax));
      const size = (p.size || 1) + ((p.sizeEnd || p.size) - (p.size || 1)) * t;
      const px = Math.max(1, Math.round(size * cellH * 0.5));

      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color || '#ffffff';
      ctx.fillRect(Math.round(sx - px / 2), Math.round(sy - px / 2), px, px);
      ctx.globalAlpha = 1.0;
    });
  }

  ctx.restore();
}
