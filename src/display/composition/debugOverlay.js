/**
 * Draw optional rules profiler overlay.
 */
export function drawRulesProfilerOverlay({ ctx, quality, prof }) {
  if (quality === "low") return;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#9cf";
  ctx.font = "12px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  if (prof && prof.lastTick) {
    const t = prof.lastTick;
    ctx.fillText(`rules dt: ${t.totalMs.toFixed(2)}ms`, 8, 40);
    const all = [];
    for (const ph of Object.keys(t.phases)) {
      const p = t.phases[ph];
      for (let i = 0; i < p.systems.length; i++) {
        const srec = p.systems[i];
        all.push({ ph, name: srec.name, ms: srec.ms });
      }
    }
    all.sort((a, b) => b.ms - a.ms);
    for (let i = 0; i < Math.min(3, all.length); i++) {
      const r = all[i];
      ctx.fillText(`${r.ph}: ${r.name} ${r.ms.toFixed(2)}ms`, 8, 56 + i * 14);
    }
  }
  ctx.restore();
}
