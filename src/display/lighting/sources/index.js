// display/lighting/sources/index.js
// Collect display-side light sources from a WorldView snapshot.

/**
 * @param {import('../../../bridge/schema/worldView.js').WorldView} view
 * @param {{quality?: string}} opts
 * @returns {Array<{ id:string|number, x:number, y:number, radius:number, intensity:number, color:string, flicker:number, style:string|null, emitter:string|null }>}
 */
export function collectLightSources(view, opts = {}) {
  const q = (opts.quality || 'auto').toLowerCase();
  const base = q === 'low' ? 5.5 : (q === 'high' ? 10.5 : 8.5);
  const radiusScale = q === 'low' ? 0.9 : (q === 'high' ? 1.1 : 1.0);
  const out = [];
  // Derive small emissive lights from tags if present
  if (Array.isArray(view.entities)) {
    for (let i = 0; i < view.entities.length; i++) {
      const e = view.entities[i];
      if (!Array.isArray(e.tags)) continue;
      if (e.tags.includes('burning')) {
        out.push({
          id: `burn:${e.id ?? i}`,
          x: e.pos.x,
          y: e.pos.y,
          radius: 1.2 * radiusScale,
          intensity: 0.22,
          color: '#ff7a2a',
          flicker: 0.12,
          style: 'burning',
          emitter: 'burning',
        });
      }
      // Intentionally no emissive light for 'invulnerable' — visualized as a ring overlay.
    }
  }
  if (Array.isArray(view.emissives)) {
    for (let i = 0; i < view.emissives.length; i++) {
      const l = view.emissives[i];
      const radius = Math.max(0, Number(l.radius) || 0) * radiusScale;
      if (!(radius > 0)) continue;
      out.push({
        id: l.id ?? `light:${i}`,
        x: l.x,
        y: l.y,
        radius,
        intensity: Math.max(0, Number(l.intensity) || 0.8),
        color: typeof l.color === 'string' ? l.color : '#ffffff',
        flicker: Math.max(0, Number(l.flicker) || 0),
        style: l.style ?? null,
        emitter: l.emitter ?? null,
      });
    }
  }
  return out;
}
