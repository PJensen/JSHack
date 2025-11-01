// Aegis Ward overlay FX (envelope-aware). Does not render the base glyph.
export function aegisWard(ctx, glyph, x, y, size, t, dt, seed, baselineY, env) {
  const a = env ? Math.min(1, env.gain) : 1;
  const pulse = 0.5 + 0.5 * Math.sin(t * 3.2 + seed * 7.1);
  const spin = t * 1.4 + seed * 2.0;
  const rCore = size * (0.58 + 0.05 * pulse);
  const rRing = rCore * (1.22 + 0.03 * Math.sin(t * 2.1 + seed));

  ctx.save();
  ctx.translate(x, y);
  ctx.textBaseline = 'alphabetic';
  ctx.font = size + 'px monospace';

  // baseline floor
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const floorGrad = ctx.createLinearGradient(0, -2, 0, 6);
  floorGrad.addColorStop(0, 'rgba(255,240,180,0.10)');
  floorGrad.addColorStop(1, 'rgba(255,220,120,0.0)');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(-size * 0.7, 0, size * 1.4, 6);
  ctx.globalAlpha = (0.35 + 0.25 * pulse) * a;
  ctx.strokeStyle = 'rgba(255,230,160,0.55)';
  ctx.lineWidth = Math.max(1, size * 0.025);
  ctx.beginPath(); ctx.moveTo(-size * 0.7, 0.5); ctx.lineTo(size * 0.7, 0.5); ctx.stroke();
  ctx.restore();

  // inner aura
  ctx.save();
  const aura = ctx.createRadialGradient(0, -size * 0.25, 2, 0, 0, rCore * 1.05);
  aura.addColorStop(0, 'rgba(255,255,255,' + (0.10 + 0.10 * pulse) + ')');
  aura.addColorStop(1, 'rgba(240,225,160,' + (0.15 + 0.15 * pulse) + ')');
  ctx.fillStyle = aura;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.9 * a;
  ctx.beginPath(); ctx.arc(0, -size * 0.25, rCore * 1.05, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // outer ring + fringe
  ctx.save();
  ctx.globalAlpha = 0.6 * a;
  ctx.lineWidth = Math.max(1, size * 0.035);
  ctx.strokeStyle = 'rgba(255,245,180,' + (0.35 + 0.25 * pulse) + ')';
  ctx.beginPath(); ctx.arc(0, -size * 0.25, rRing, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 0.25 * a;
  ctx.strokeStyle = 'rgba(120,220,255,' + (0.25 * pulse) + ')';
  ctx.beginPath(); ctx.arc(0, -size * 0.25, rRing * 1.02, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  // rotating hex ward
  ctx.save();
  ctx.translate(0, -size * 0.25);
  ctx.rotate(spin);
  const sides = 6;
  const hexR = rCore * 0.82;
  ctx.globalAlpha = (0.45 + 0.25 * pulse) * a;
  ctx.lineWidth = Math.max(1, size * 0.02);
  ctx.strokeStyle = 'rgba(255,235,170,0.9)';
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const aa = (i / sides) * Math.PI * 2;
    const px = Math.cos(aa) * hexR; const py = Math.sin(aa) * hexR;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.stroke();

  // runes
  ctx.globalAlpha = 0.7 * a;
  for (let i = 0; i < sides; i++) {
    const aa = (i / sides) * Math.PI * 2;
    const px = Math.cos(aa) * hexR; const py = Math.sin(aa) * hexR;
    const s = 1 + 0.4 * Math.sin(t * 6 + seed * 5 + i);
    ctx.beginPath(); ctx.arc(px, py, Math.max(0.8, size * 0.015) * s, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,220,0.85)'; ctx.fill();
  }
  ctx.restore();

  // echoes
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 3; i >= 1; i--) {
    const k = i / 3;
    ctx.globalAlpha = (0.08 + 0.08 * k * (0.6 + 0.4 * pulse)) * a;
    ctx.fillStyle = 'rgba(255,240,190,0.7)';
    const ox = Math.sin(t * (7 + i) + seed * 3.1) * size * 0.02 * i;
    const oy = Math.cos(t * (5.5 + i) + seed * 2.2) * size * 0.016 * i;
    ctx.fillText(glyph, -size / 2 + ox, oy);
  }
  ctx.restore();

  // sweep spark
  ctx.save();
  ctx.translate(0, -size * 0.25);
  const sweepA = (t * 2.6 + seed) % (Math.PI * 2);
  const sx = Math.cos(sweepA) * rRing, sy = Math.sin(sweepA) * rRing;
  ctx.globalAlpha = (0.35 + 0.35 * pulse) * a;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath(); ctx.ellipse(sx, sy, size * 0.05, size * 0.015, sweepA, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.restore();
}

export default aegisWard;
