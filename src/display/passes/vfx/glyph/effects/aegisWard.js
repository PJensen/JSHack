// Aegis Ward overlay FX (envelope-aware). Does not render the base glyph.
// Signature: (ctx, glyph, x, y, size, t, dt, seed, baselineY, env)
export function aegisWard(ctx, glyph, x, y, size, t, _dt, seed, _baselineY, env) {
  const a = env ? Math.min(1, env.gain) : 1;
  const fxSize = size * 1.15;
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.4 + seed * 1.1);
  const centerY = y + fxSize * 0.03;
  const rCore = fxSize * (0.46 + 0.03 * pulse);
  const rRing = fxSize * (0.62 + 0.02 * pulse);
  const spin = t * 0.7 + seed * 0.6;

  ctx.save();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const aura = ctx.createRadialGradient(x, centerY, rCore * 0.15, x, centerY, rRing * 1.08);
  aura.addColorStop(0, `rgba(210,242,255,${(0.17 + 0.08 * pulse).toFixed(3)})`);
  aura.addColorStop(0.5, `rgba(95,210,245,${(0.09 + 0.06 * pulse).toFixed(3)})`);
  aura.addColorStop(1, 'rgba(50,120,210,0)');
  ctx.fillStyle = aura;
  ctx.globalAlpha = 1.0 * a;
  ctx.beginPath();
  ctx.arc(x, centerY, rRing * 1.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // restrained sigil
  ctx.save();
  ctx.translate(x, centerY);
  ctx.rotate(spin);
  ctx.globalCompositeOperation = 'lighter';

  const drawHex = (radius, alpha, color, lw) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const px = Math.cos(ang) * radius;
      const py = Math.sin(ang) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.globalAlpha = alpha * a;
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.stroke();
  };

  drawHex(rCore * 0.98, 0.34 + 0.13 * pulse, 'rgba(235,248,255,0.9)', Math.max(0.014, fxSize * 0.013));
  drawHex(rCore * 0.72, 0.22 + 0.10 * pulse, 'rgba(140,225,250,0.9)', Math.max(0.010, fxSize * 0.010));

  // small node pips
  ctx.globalAlpha = (0.26 + 0.12 * pulse) * a;
  ctx.fillStyle = 'rgba(245,252,255,0.9)';
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + t * 0.3;
    const px = Math.cos(ang) * rCore * 1.02;
    const py = Math.sin(ang) * rCore * 1.02;
    const dotR = Math.max(0.008, fxSize * 0.010);
    ctx.beginPath();
    ctx.arc(px, py, dotR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // one quiet orbit spark
  ctx.save();
  ctx.translate(x, centerY);
  ctx.globalCompositeOperation = 'lighter';
  const ang = t * 1.8 + seed * 0.5;
  const px = Math.cos(ang) * rRing * 0.92;
  const py = Math.sin(ang) * rRing * 0.92;
  ctx.globalAlpha = (0.25 + 0.18 * pulse) * a;
  ctx.fillStyle = 'rgba(240,250,255,0.95)';
  ctx.beginPath();
  ctx.ellipse(px, py, fxSize * 0.020, fxSize * 0.007, ang, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

export default aegisWard;
