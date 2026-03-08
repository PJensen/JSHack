// Dragon breath overlay FX (envelope-aware). Does not render the base glyph.
// Signature: (ctx, glyph, x, y, size, t, dt, seed, baselineY, env, opts?)
export function dragonBreath(ctx, glyph, x, y, size, t, _dt, seed, _baselineY, env) {
  const a = env ? Math.min(1, env.gain) : 1;
  const pulse = 0.5 + 0.5 * Math.sin(t * 16 + seed * 0.11);
  const heat = 0.5 + 0.5 * Math.sin(t * 23 + seed * 0.17);
  const fxSize = size * (1.10 + 0.06 * pulse);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  const aura = ctx.createRadialGradient(x, y, fxSize * 0.08, x, y, fxSize * 0.95);
  aura.addColorStop(0, `rgba(255,248,220,${(0.22 + 0.10 * pulse).toFixed(3)})`);
  aura.addColorStop(0.40, `rgba(255,150,48,${(0.18 + 0.12 * heat).toFixed(3)})`);
  aura.addColorStop(1, "rgba(160,30,0,0)");
  ctx.fillStyle = aura;
  ctx.globalAlpha = 0.95 * a;
  ctx.beginPath();
  ctx.arc(x, y, fxSize * 0.95, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.font = `${fxSize}px monospace`;
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(0.018, fxSize * 0.050);
  ctx.strokeStyle = `rgba(255,245,220,${(0.90 * a).toFixed(3)})`;
  ctx.shadowColor = `rgba(255,120,24,${(0.85 * a).toFixed(3)})`;
  ctx.shadowBlur = fxSize * (0.22 + 0.12 * pulse);
  ctx.strokeText(glyph, x - fxSize / 2, y);
  ctx.fillStyle = `rgba(255,120,32,${(0.30 * a).toFixed(3)})`;
  ctx.fillText(glyph, x - fxSize / 2, y);
  ctx.restore();

  const crownY = y - fxSize * 0.48;
  const hornSpan = fxSize * 0.42;
  const hornRise = fxSize * (0.14 + 0.04 * pulse);
  const emberR = fxSize * 0.055;

  ctx.strokeStyle = `rgba(255,210,120,${(0.70 * a).toFixed(3)})`;
  ctx.lineWidth = Math.max(0.014, fxSize * 0.030);
  ctx.beginPath();
  ctx.moveTo(x - hornSpan, crownY + hornRise * 0.8);
  ctx.quadraticCurveTo(x - hornSpan * 0.55, crownY - hornRise, x - fxSize * 0.06, crownY + hornRise * 0.15);
  ctx.moveTo(x + hornSpan, crownY + hornRise * 0.8);
  ctx.quadraticCurveTo(x + hornSpan * 0.55, crownY - hornRise, x + fxSize * 0.06, crownY + hornRise * 0.15);
  ctx.stroke();

  ctx.fillStyle = `rgba(255,235,180,${(0.76 * a).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(x - hornSpan * 0.72, crownY, emberR, 0, Math.PI * 2);
  ctx.arc(x + hornSpan * 0.72, crownY, emberR, 0, Math.PI * 2);
  ctx.fill();

  const spit = fxSize * (0.28 + 0.08 * heat);
  ctx.fillStyle = `rgba(255,100,24,${(0.34 * a).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(x + fxSize * 0.20, y - fxSize * 0.02, spit * 0.45, spit * 0.18, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255,220,150,${(0.22 * a).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(x + fxSize * 0.28, y - fxSize * 0.05, spit * 0.20, spit * 0.08, -0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export default dragonBreath;
