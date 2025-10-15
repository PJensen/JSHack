// Neon Pulse overlay FX (envelope-aware). Does not render the base glyph.
// Signature: (ctx, glyph, x, y, size, t, dt, seed, baselineY, env, opts?)
export function neonPulse(ctx, glyph, x, y, size, t, dt, seed, baselineY, env) {
  const a = env ? Math.min(1, env.gain * 1.1) : 1;
  ctx.save();
  ctx.font = size + 'px monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = Math.max(1, size * 0.06);
  ctx.strokeStyle = 'rgba(80,255,200,0.9)';
  ctx.shadowColor = 'rgba(80,255,200,1)';
  const pul = 0.5 + 0.5 * Math.sin(t * 4 + seed);
  ctx.shadowBlur = size * (0.18 + 0.25 * pul) * a;
  ctx.globalAlpha = 0.85 * a;
  ctx.strokeText(glyph, x - size / 2, y);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.35 * a;
  ctx.fillStyle = 'rgba(10,30,24,1)';
  ctx.fillText(glyph, x - size / 2, y);
  ctx.restore();
}

export default neonPulse;
