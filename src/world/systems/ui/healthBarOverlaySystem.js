    // Health Bar Overlay System: draws the player's HP bar as a HUD element
// READONLY: only reads components and RenderContext; no mutations
import { RenderContext } from '../../components/RenderContext.js';
import { Player } from '../../components/Player.js';
import { Health } from '../../components/Health.js';

export function healthBarOverlaySystem(world){
  const rcId = world.renderContextId; if (!rcId) return;
  const rc = world.get(rcId, RenderContext); if (!rc) return;
  const ctx = rc.presentCtx || rc.ctx; if (!ctx) return;

  // Fetch the player's health (first entity with Player+Health)
  let hp = 0, maxHp = 0;
  for (const [id, h] of world.query(Health, Player)){
    hp = Math.max(0, h.hp|0);
    maxHp = Math.max(1, h.maxHp|0);
    break; // assume single player
  }
  if (maxHp <= 0) return;

  // Save/restore full drawing state; draw in absolute CSS pixel coordinates
  const W = rc.W|0, H = rc.H|0;
  const prevFont = ctx.font, prevFill = ctx.fillStyle, prevAlpha = ctx.globalAlpha, prevAlign = ctx.textAlign, prevBase = ctx.textBaseline;
  ctx.save();
  try {
    // Reset transform so overlay is stable regardless of scene transforms
    if (typeof ctx.setTransform === 'function') ctx.setTransform(1,0,0,1,0,0);
    ctx.globalAlpha = 1.0;

    // Layout
  const pad = 8; // outer padding from canvas edges
  const barW = Math.max(120, Math.round((rc.cols || 20) * (rc.cellW || 16) * 0.4));
  const barH = Math.max(12, Math.round((rc.cellH || 16) * 0.6));
  // Top-right placement
  const x = Math.max(0, (W|0) - pad - barW);
  const y = pad;

    // Background pill
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    const pillPad = 6;
    ctx.fillRect(x - pillPad, y - pillPad, barW + pillPad*2, barH + pillPad*2);

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 0.5, y - 0.5, barW + 1, barH + 1);

    // Fill amount
    const pct = Math.max(0, Math.min(1, hp / maxHp));
    // Color from green -> yellow -> red
    const r = pct < 0.5 ? 255 : Math.round(255 * (1 - (pct - 0.5) * 2));
    const g = pct > 0.5 ? 255 : Math.round(255 * (pct * 2));
    const fill = `rgb(${r|0},${g|0},80)`;
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, Math.round(barW * pct), barH);

    // Text
    ctx.font = `${Math.max(10, Math.round(barH * 0.8))}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#111';
    ctx.fillText(`HP ${hp}/${maxHp}`.toString(), x + barW/2 + 1, y + barH/2 + 1);
    ctx.fillStyle = '#fff';
    ctx.fillText(`HP ${hp}/${maxHp}`.toString(), x + barW/2, y + barH/2);
  } finally {
    ctx.restore();
    ctx.font = prevFont; ctx.fillStyle = prevFill; ctx.globalAlpha = prevAlpha; ctx.textAlign = prevAlign; ctx.textBaseline = prevBase;
  }
}
