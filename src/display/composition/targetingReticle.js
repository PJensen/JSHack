/**
 * Draw keyboard targeting reticle in world space.
 */
export function drawTargetingReticle({
  bctx,
  targetCursor,
  hasPendingSpellTargeting,
  hasPendingThrowTargeting,
  fxTime,
}) {
  if (!bctx || !targetCursor || (!hasPendingSpellTargeting && !hasPendingThrowTargeting)) return;
  bctx.save();
  const cx = targetCursor.x;
  const cy = targetCursor.y;
  const pulse = 0.6 + 0.4 * Math.sin(fxTime * 6.0);
  bctx.strokeStyle = `rgba(255,220,80,${(0.7 * pulse).toFixed(3)})`;
  bctx.lineWidth = 0.08;
  bctx.beginPath();
  bctx.arc(cx, cy, 0.42, 0, Math.PI * 2);
  bctx.stroke();
  const s = 0.46;
  const l = 0.14;
  bctx.strokeStyle = `rgba(255,255,200,${(0.85 * pulse).toFixed(3)})`;
  bctx.lineWidth = 0.06;
  bctx.beginPath();
  bctx.moveTo(cx - s, cy - s + l); bctx.lineTo(cx - s, cy - s); bctx.lineTo(cx - s + l, cy - s);
  bctx.moveTo(cx + s, cy - s + l); bctx.lineTo(cx + s, cy - s); bctx.lineTo(cx + s - l, cy - s);
  bctx.moveTo(cx - s, cy + s - l); bctx.lineTo(cx - s, cy + s); bctx.lineTo(cx - s + l, cy + s);
  bctx.moveTo(cx + s, cy + s - l); bctx.lineTo(cx + s, cy + s); bctx.lineTo(cx + s - l, cy + s);
  bctx.stroke();
  bctx.restore();
}
