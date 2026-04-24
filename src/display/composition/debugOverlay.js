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

/**
 * Draw optional render profiler overlay.
 */
export function drawRenderProfilerOverlay({ ctx, quality, prof }) {
  if (quality === "low") return;
  if (!prof || prof.enabled !== true || !prof.lastFrame) return;
  const f = prof.lastFrame;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#dfb";
  ctx.font = "12px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const y0 = 110;
  ctx.fillText(`render dt: ${f.totalMs.toFixed(2)}ms  fps:${Number(f.fps || 0).toFixed(1)}`, 8, y0);
  ctx.fillText(`tiles ${f.tilesDrawn}/${f.tilesVisited} post:${f.postTiles}`, 8, y0 + 14);
  ctx.fillText(`ents ${f.entitiesDrawn}/${f.entitiesVisited} stack:${f.itemStackScanned} roofs:${f.roofsDrawn}`, 8, y0 + 28);
  ctx.fillText(`light area:${Number(f.lightingArea || 0)}${f.lightingCapped ? " capped" : ""}`, 8, y0 + 42);
  const stages = f.stages || {};
  const top = Object.keys(stages)
    .map((name) => ({ name, ms: Number(stages[name] || 0) }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 3);
  for (let i = 0; i < top.length; i++) {
    ctx.fillText(`${top[i].name}: ${top[i].ms.toFixed(2)}ms`, 8, y0 + 56 + i * 14);
  }
  ctx.restore();
}
