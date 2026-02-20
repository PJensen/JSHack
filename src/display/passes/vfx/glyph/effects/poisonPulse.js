// Poison Pulse overlay FX (envelope-aware). Does not render the base glyph.
// Signature: (ctx, glyph, x, y, size, t, dt, seed, baselineY, env)
export function poisonPulse(ctx, glyph, x, y, size, t, dt, seed, baselineY, env) {
  const a = env ? Math.min(1, env.gain * 1.1) : 1;
  const pul = 0.5 + 0.5 * Math.sin(t * 3.5 + seed * 1.3);

  ctx.save();
  ctx.font = size + 'px monospace';
  ctx.textBaseline = 'alphabetic';

  // Green neon glow stroke
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = Math.max(1, size * 0.06);
  ctx.strokeStyle = 'rgba(50,220,80,0.9)';
  ctx.shadowColor = 'rgba(50,255,80,1)';
  ctx.shadowBlur = size * (0.16 + 0.22 * pul) * a;
  ctx.globalAlpha = 0.80 * a;
  ctx.strokeText(glyph, x - size / 2, y);
  ctx.shadowBlur = 0;

  // Dark green fill underneath for depth
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.30 * a;
  ctx.fillStyle = 'rgba(5,20,8,1)';
  ctx.fillText(glyph, x - size / 2, y);

  // Bubble / drip strokes below baseline
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = Math.max(0.5, size * 0.03);
  const nDrips = 3;
  for (let i = 0; i < nDrips; i++) {
    const ox = (i - 1) * size * 0.22;
    const phase = t * 2.8 + seed * 3.1 + i * 2.0;
    const dripLen = size * (0.10 + 0.06 * Math.sin(phase));
    const alpha = (0.55 + 0.30 * Math.sin(phase * 0.7)) * a;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(60,255,90,0.9)';
    ctx.beginPath();
    ctx.moveTo(x + ox, y + size * 0.08);
    ctx.lineTo(x + ox, y + size * 0.08 + dripLen);
    ctx.stroke();
  }

  ctx.restore();
}

export default poisonPulse;
