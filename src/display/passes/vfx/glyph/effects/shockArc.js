// Shock Arc overlay FX (envelope-aware). Does not render the base glyph.
// Signature: (ctx, glyph, x, y, size, t, dt, seed, baselineY, env)
export function shockArc(ctx, glyph, x, y, size, t, _dt, seed, _baselineY, env) {
  const a = env ? Math.min(1, env.gain) : 1;

  // Discrete flicker phase — snaps every ~100ms for electric strobe effect
  const flickerPhase = Math.floor(t * 10 + seed * 7);
  const fRng = (n) => ((flickerPhase * 2654435761 + n * 40503) >>> 0) / 4294967296;
  // Continuous strobe brightness to ride on top of the discrete flicker
  const strobe = 0.6 + 0.4 * fRng(77);

  const center = { x, y: y - size * 0.22 };
  const nArcs = 7;
  const arcR = size * 0.65;

  ctx.save();

  // --- Glyph stroke: bright electric blue-white with heavy shadow glow ---
  ctx.save();
  ctx.font = size + 'px monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = Math.max(1.5, size * 0.07);
  ctx.strokeStyle = `rgba(160,230,255,${(0.85 * strobe).toFixed(3)})`;
  ctx.shadowColor = 'rgba(100,210,255,1)';
  ctx.shadowBlur = size * (0.30 + 0.25 * strobe) * a;
  ctx.globalAlpha = (0.80 + 0.20 * strobe) * a;
  ctx.strokeText(glyph, x - size / 2, y);
  ctx.shadowBlur = 0;

  // Bright white core stroke over the top — thin, creates the "burning" center look
  ctx.lineWidth = Math.max(0.8, size * 0.025);
  ctx.strokeStyle = `rgba(230,248,255,${(0.70 * strobe).toFixed(3)})`;
  ctx.globalAlpha = (0.65 + 0.35 * strobe) * a;
  ctx.strokeText(glyph, x - size / 2, y);
  ctx.restore();

  // --- Arcs ---
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.globalCompositeOperation = 'lighter';

  // Wide outer ambient field — the "electric charge" aura
  const outerAura = ctx.createRadialGradient(0, 0, arcR * 0.2, 0, 0, arcR * 1.3);
  outerAura.addColorStop(0, `rgba(80,190,255,${(0.14 * strobe).toFixed(3)})`);
  outerAura.addColorStop(0.5, `rgba(40,140,220,${(0.08 * strobe).toFixed(3)})`);
  outerAura.addColorStop(1, 'rgba(0,100,200,0)');
  ctx.fillStyle = outerAura;
  ctx.globalAlpha = a;
  ctx.beginPath();
  ctx.arc(0, 0, arcR * 1.3, 0, Math.PI * 2);
  ctx.fill();

  // Inner electric core glow
  const coreGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.38);
  coreGlow.addColorStop(0, `rgba(220,248,255,${(0.55 * strobe).toFixed(3)})`);
  coreGlow.addColorStop(0.4, `rgba(100,210,255,${(0.30 * strobe).toFixed(3)})`);
  coreGlow.addColorStop(1, 'rgba(0,160,255,0)');
  ctx.fillStyle = coreGlow;
  ctx.globalAlpha = (0.90 + 0.10 * fRng(99)) * a;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.38, 0, Math.PI * 2);
  ctx.fill();

  // Jagged radial arcs
  for (let i = 0; i < nArcs; i++) {
    const baseAngle = (i / nArcs) * Math.PI * 2 + fRng(i * 3) * 0.5;
    const arcAlpha = (0.75 + 0.25 * fRng(i * 7 + 1)) * strobe * a;
    const isWhiteCore = fRng(i * 5 + 2) > 0.5;
    const thisArcR = arcR * (0.75 + 0.35 * fRng(i * 13 + 6));

    ctx.save();
    ctx.globalAlpha = arcAlpha;
    ctx.lineWidth = Math.max(1.0, size * (isWhiteCore ? 0.030 : 0.048));
    ctx.strokeStyle = isWhiteCore ? 'rgba(230,248,255,0.98)' : 'rgba(60,200,255,0.92)';
    ctx.shadowColor = isWhiteCore ? 'rgba(200,240,255,0.8)' : 'rgba(0,180,255,0.8)';
    ctx.shadowBlur = size * 0.08;

    const nSegs = 4 + Math.floor(fRng(i * 11 + 3) * 4);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    let cx2 = 0, cy2 = 0;
    for (let s = 1; s <= nSegs; s++) {
      const t2 = s / nSegs;
      const jitter = (fRng(i * 17 + s * 3 + 4) - 0.5) * thisArcR * 0.50 * (1 - t2 * 0.4);
      const perpAngle = baseAngle + Math.PI / 2;
      cx2 = Math.cos(baseAngle) * thisArcR * t2 + Math.cos(perpAngle) * jitter;
      cy2 = Math.sin(baseAngle) * thisArcR * t2 + Math.sin(perpAngle) * jitter;
      ctx.lineTo(cx2, cy2);
    }
    ctx.stroke();

    // Spark at the tip
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(220,245,255,0.95)';
    ctx.beginPath();
    ctx.arc(cx2, cy2, Math.max(1.0, size * 0.032), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
}

export default shockArc;
