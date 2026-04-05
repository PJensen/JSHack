// Acid pulse overlay FX (envelope-aware). Corrosive green glow on acid creatures.
// Signature: (ctx, glyph, x, y, size, t, dt, seed, baselineY, env, opts?)
export function acidPulse(ctx, glyph, x, y, size, t, _dt, seed, _baselineY, env) {
  const a = env ? Math.min(1, env.gain) : 1;
  const pulse = 0.5 + 0.5 * Math.sin(t * 14 + seed * 0.13);
  const drip = 0.5 + 0.5 * Math.sin(t * 21 + seed * 0.19);
  const fxSize = size * (1.06 + 0.04 * pulse);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // Toxic aura
  const aura = ctx.createRadialGradient(x, y, fxSize * 0.06, x, y, fxSize * 0.90);
  aura.addColorStop(0, `rgba(180,255,120,${(0.18 + 0.08 * pulse).toFixed(3)})`);
  aura.addColorStop(0.45, `rgba(100,220,50,${(0.14 + 0.10 * drip).toFixed(3)})`);
  aura.addColorStop(1, "rgba(60,140,20,0)");
  ctx.fillStyle = aura;
  ctx.globalAlpha = 0.85 * a;
  ctx.beginPath();
  ctx.arc(x, y, fxSize * 0.90, 0, Math.PI * 2);
  ctx.fill();

  // Glyph outline with acid glow
  ctx.save();
  ctx.font = `${fxSize}px monospace`;
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(0.016, fxSize * 0.045);
  ctx.strokeStyle = `rgba(180,255,130,${(0.80 * a).toFixed(3)})`;
  ctx.shadowColor = `rgba(100,240,50,${(0.75 * a).toFixed(3)})`;
  ctx.shadowBlur = fxSize * (0.18 + 0.10 * pulse);
  ctx.strokeText(glyph, x - fxSize / 2, y);
  ctx.fillStyle = `rgba(120,220,60,${(0.25 * a).toFixed(3)})`;
  ctx.fillText(glyph, x - fxSize / 2, y);
  ctx.restore();

  // Dripping acid droplets below the glyph
  const dripY = y + fxSize * 0.35;
  const dripOff = fxSize * 0.12 * drip;
  ctx.fillStyle = `rgba(140,240,60,${(0.40 * a).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(x - fxSize * 0.10, dripY + dripOff, fxSize * 0.04, fxSize * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + fxSize * 0.14, dripY + dripOff * 0.7, fxSize * 0.03, fxSize * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export default acidPulse;
