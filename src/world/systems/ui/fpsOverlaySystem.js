// FPS Overlay System: draws FPS in the top-left corner of the canvas
// READONLY: only reads RenderContext and time; maintains small counters on RC
import { RenderContext } from '../../components/RenderContext.js';

export function fpsOverlaySystem(world){
  const rcId = world.renderContextId; if (!rcId) return;
  const rc = world.get(rcId, RenderContext); if (!rc || rc.showFps === false) return;
  const ctx = rc.ctx; if (!ctx) return;
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const last = rc._fps_last_ts || now;
  const dt = Math.max(1e-6, now - last);
  const inst = 1000 / dt;
  const ema = (rc._fps_ema != null) ? (rc._fps_ema * 0.9 + inst * 0.1) : inst;
  rc._fps_last_ts = now; rc._fps_ema = ema;

  // Draw overlay in absolute CSS pixel coordinates; reset transform to identity
  const W = rc.W|0, H = rc.H|0;
  const prevFont = ctx.font, prevFill = ctx.fillStyle, prevAlpha = ctx.globalAlpha, prevAlign = ctx.textAlign, prevBase = ctx.textBaseline;
  ctx.save();
  try {
    // Ensure no translation scaling leaks in
    if (typeof ctx.setTransform === 'function') ctx.setTransform(1,0,0,1,0,0);
    ctx.globalAlpha = 1.0;
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    // background pill for readability
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    const padX = 6, padY = 4; const boxW = 80, boxH = 20;
    ctx.fillRect(8, 8, boxW, boxH);
    // color by FPS
    const c = ema >= 58 ? '#0f0' : ema >= 45 ? '#ff0' : '#f66';
    ctx.fillStyle = c;
    ctx.fillText(`FPS ${(ema).toFixed(1)}`, 12, 10);
  } finally {
    ctx.restore();
    ctx.font = prevFont; ctx.fillStyle = prevFill; ctx.globalAlpha = prevAlpha; ctx.textAlign = prevAlign; ctx.textBaseline = prevBase;
  }
}
