// display/lighting/sources/index.js
// Collect display-side light sources from a WorldView snapshot.

/**
 * @param {import('../../../bridge/schema/worldView.js').WorldView} view
 * @param {{quality?: string}} opts
 * @returns {Array<{x:number,y:number,radius:number}>}
 */
export function collectLightSources(view, opts = {}) {
  const q = (opts.quality || 'auto').toLowerCase();
  const base = q === 'low' ? 6 : (q === 'high' ? 10 : 8);
  const out = [];
  if (view.player) {
    out.push({ x: view.player.pos.x | 0, y: view.player.pos.y | 0, radius: base });
  }
  // Derive small emissive lights from tags if present
  if (Array.isArray(view.entities)) {
    for (let i = 0; i < view.entities.length; i++) {
      const e = view.entities[i];
      if (Array.isArray(e.tags) && (e.tags.includes('burning') || e.tags.includes('invulnerable') || e.tags.includes('glowing'))) {
        out.push({ x: e.pos.x | 0, y: e.pos.y | 0, radius: 3 });
      }
    }
  }
  return out;
}
