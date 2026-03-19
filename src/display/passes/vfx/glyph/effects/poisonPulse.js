// Poison Pulse overlay FX (envelope-aware). Does not render the base glyph.
// Signature: (ctx, glyph, x, y, size, t, dt, seed, baselineY, env)
export function poisonPulse(ctx, glyph, x, y, size, t, dt, seed, baselineY, env) {
  const a = env ? Math.min(1, env.gain * 1.1) : 1;

  // Sickly undulation: slow primary wave with a sharper secondary surge near the peak.
  // Feels nauseating rather than cardiac — ~0.8 s cycle.
  const wave  = Math.sin(t * 1.25 + seed * 1.7);
  const surge = Math.max(0, wave - 0.4) / 0.6; // only fires when wave > 0.4
  const pul   = 0.5 + 0.35 * wave + 0.15 * surge;

  ctx.save();
  ctx.font = size + 'px monospace';
  ctx.textBaseline = 'alphabetic';

  // Sickly green glow stroke — undulates with the wave
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = Math.max(1, size * 0.055);
  ctx.strokeStyle = 'rgba(40,200,65,0.90)';
  ctx.shadowColor = 'rgba(60,255,70,1)';
  ctx.shadowBlur = size * (0.10 + 0.28 * pul) * a;
  ctx.globalAlpha = (0.70 + 0.20 * pul) * a;
  ctx.strokeText(glyph, x - size / 2, y);
  ctx.shadowBlur = 0;

  // Dark bile fill for depth
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.22 * a;
  ctx.fillStyle = 'rgba(5,18,3,1)';
  ctx.fillText(glyph, x - size / 2, y);

  // Poison drips — thinner and faster than blood, same droplet-tip structure
  ctx.globalCompositeOperation = 'lighter';
  const nDrips = 3;
  for (let i = 0; i < nDrips; i++) {
    const ox    = (i - 1) * size * 0.20;
    const phase = t * 1.6 + seed * 2.7 + i * 2.3;
    const dripLen    = size * (0.14 + 0.10 * Math.sin(phase));
    const trailAlpha = (0.50 + 0.25 * Math.sin(phase * 0.6)) * a;

    // Trail line — thinner than blood; poison is more liquid
    ctx.lineWidth  = Math.max(0.8, size * 0.030);
    ctx.globalAlpha = trailAlpha;
    ctx.strokeStyle = 'rgba(35,190,55,0.95)';
    ctx.beginPath();
    ctx.moveTo(x + ox, y + size * 0.05);
    ctx.lineTo(x + ox, y + size * 0.05 + dripLen);
    ctx.stroke();

    // Droplet at the tip — bile-green, slightly smaller than blood
    const dropR = Math.max(0.8, size * 0.028 * (0.75 + 0.5 * Math.abs(Math.sin(phase * 0.55))));
    const dropY = y + size * 0.05 + dripLen + dropR;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = trailAlpha * 0.85 * a;
    ctx.fillStyle = 'rgba(20,140,38,0.90)';
    ctx.beginPath();
    ctx.arc(x + ox, dropY, dropR, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';

    // Bubble rising from the drip tip — the tell-tale sign of poison, not blood.
    // Each drip spawns one bubble per ~1.1 s that drifts upward and fades.
    const bPhase = t * 0.9 + seed * 1.4 + i * 3.7;
    const bT     = (bPhase % 1);          // 0–1 rise progress within this cycle
    if (bT < 0.55) {
      const rise   = bT / 0.55;           // 0→1 as bubble ascends
      const bx     = x + ox + Math.sin(bPhase * 4.1) * size * 0.07;
      const by     = dropY - rise * size * 0.28;
      const bR     = Math.max(0.5, size * 0.018 * (1 - rise * 0.35));
      ctx.globalAlpha  = (0.40 - 0.35 * rise) * a;
      ctx.strokeStyle  = 'rgba(90,255,110,0.9)';
      ctx.lineWidth    = Math.max(0.4, size * 0.012);
      ctx.beginPath();
      ctx.arc(bx, by, bR, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore();
}

export default poisonPulse;
