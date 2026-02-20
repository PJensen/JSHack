// Frozen Crystal overlay FX (envelope-aware). Does not render the base glyph.
// Signature: (ctx, glyph, x, y, size, t, dt, seed, baselineY, env)
export function frozenCrystal(ctx, glyph, x, y, size, t, dt, seed, baselineY, env) {
  const a = env ? Math.min(1, env.gain) : 1;
  const pulse = 0.5 + 0.5 * Math.sin(t * 1.8 + seed * 2.5);
  // Spin slowly — frozen things still rotate, just not as fast as fire
  const spin = t * 0.55 + seed * 1.1;
  const center = { x, y: y - size * 0.25 };
  const rCore = size * (0.52 + 0.03 * pulse);
  const rHex  = rCore * 0.80;

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.textBaseline = 'alphabetic';
  ctx.font = size + 'px monospace';

  // Frosty radial aura
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const aura = ctx.createRadialGradient(0, 0, rCore * 0.2, 0, 0, rCore * 1.15);
  aura.addColorStop(0, `rgba(180,240,255,${(0.08 + 0.06 * pulse).toFixed(3)})`);
  aura.addColorStop(1, 'rgba(100,200,240,0)');
  ctx.fillStyle = aura;
  ctx.globalAlpha = 0.9 * a;
  ctx.beginPath();
  ctx.arc(0, 0, rCore * 1.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Rotating hexagon frame (icy blue)
  ctx.save();
  ctx.rotate(spin);
  ctx.globalAlpha = (0.50 + 0.20 * pulse) * a;
  ctx.lineWidth = Math.max(0.8, size * 0.025);
  ctx.strokeStyle = `rgba(140,220,255,0.85)`;
  ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const px = Math.cos(ang) * rHex;
    const py = Math.sin(ang) * rHex;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();

  // Crystalline spike at each vertex
  ctx.lineWidth = Math.max(0.5, size * 0.015);
  ctx.strokeStyle = 'rgba(200,240,255,0.70)';
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const vx = Math.cos(ang) * rHex;
    const vy = Math.sin(ang) * rHex;
    const tipScale = 1.28 + 0.06 * Math.sin(t * 4 + seed * 3 + i);
    const tx2 = Math.cos(ang) * rHex * tipScale;
    const ty2 = Math.sin(ang) * rHex * tipScale;
    // Left flange
    const la = ang + Math.PI / 6;
    const lx = Math.cos(la) * size * 0.06;
    const ly = Math.sin(la) * size * 0.06;
    ctx.beginPath();
    ctx.moveTo(vx + lx, vy + ly);
    ctx.lineTo(tx2, ty2);
    ctx.lineTo(vx - lx, vy - ly);
    ctx.stroke();
  }

  // Small ice dots at vertices
  ctx.fillStyle = 'rgba(220,245,255,0.80)';
  ctx.globalAlpha = (0.65 + 0.25 * pulse) * a;
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const px = Math.cos(ang) * rHex;
    const py = Math.sin(ang) * rHex;
    const dotR = Math.max(0.5, size * 0.012) * (1 + 0.3 * Math.sin(t * 5 + seed * 4 + i));
    ctx.beginPath();
    ctx.arc(px, py, dotR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Outer thin ring + inner shimmer
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.4 * a;
  ctx.lineWidth = Math.max(0.5, size * 0.018);
  ctx.strokeStyle = `rgba(160,230,255,${(0.30 + 0.20 * pulse).toFixed(2)})`;
  ctx.beginPath();
  ctx.arc(0, 0, rCore * 1.12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

export default frozenCrystal;
