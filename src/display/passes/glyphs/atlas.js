// display/passes/glyphs/atlas.js
// Pre-render glyphs to bitmaps to avoid per-frame text, shadows, and composites.

/**
 * Build a glyph atlas for the provided palette.
 * Each entry is a 1x1 world-unit stamp (drawn with ctx scale via camera) using a bitmap.
 * We render into a square canvas (e.g., 64x64 px) centered, then drawImage with size 1x1 in world units.
 */
export function createGlyphAtlas(palette, opts = {}) {
  const sizePx = opts.sizePx || 64; // bitmap resolution per tile
  const fontPx = opts.fontPx || 56; // a little smaller than sizePx to leave padding
  const glowLayers = Math.max(0, opts.glowLayers | 0);

  const atlas = new Map(); // kind -> { canvas }

  for (const [kind, look] of Object.entries(palette)) {
    const cnv = document.createElement('canvas');
    cnv.width = sizePx; cnv.height = sizePx;
    const fgCnv = document.createElement('canvas');
    fgCnv.width = sizePx; fgCnv.height = sizePx;
    const g = cnv.getContext('2d');
    const fgCtx = fgCnv.getContext('2d');
    renderLook(g, look, { sizePx, fontPx, glowLayers, includeBackground: true });
    renderLook(fgCtx, look, { sizePx, fontPx, glowLayers, includeBackground: false });

    atlas.set(kind, {
      canvas: cnv,
      fgCanvas: fgCnv,
      baseScale: (typeof look.baseScale === 'number') ? look.baseScale : 1,
    });
  }

  // Ensure a default entry exists
  if (!atlas.has('default')) {
    const cnv = document.createElement('canvas');
    cnv.width = sizePx; cnv.height = sizePx;
    const g = cnv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `900 ${fontPx}px monospace`;
    g.fillStyle = '#fff';
    g.fillText('?', sizePx * 0.5, sizePx * 0.5);
    atlas.set('default', { canvas: cnv, fgCanvas: cnv, baseScale: 1 });
  }

  return atlas;
}

function renderLook(g, look, { sizePx, fontPx, glowLayers, includeBackground }) {
  g.imageSmoothingEnabled = false;
  g.textAlign = 'center';
  g.textBaseline = 'middle';

  if (Array.isArray(look.layers) && look.layers.length > 0) {
    const bgColor = look.layers[0].bg || look.bg;
    if (includeBackground && bgColor) {
      g.fillStyle = bgColor;
      g.fillRect(0, 0, sizePx, sizePx);
    }
    for (const layer of look.layers) {
      const lGlyph = layer.glyph || '?';
      const lFg = layer.fg || '#fff';
      const lGlow = layer.glow || lFg;
      const lScale = (typeof layer.scale === 'number') ? layer.scale : 1;
      const lFontPx = Math.round(fontPx * lScale);
      const cx = sizePx * (0.5 + (layer.dx || 0));
      const cy = sizePx * (0.5 + (layer.dy || 0));
      g.font = `900 ${lFontPx}px monospace`;
      if (glowLayers > 0) {
        g.globalCompositeOperation = 'lighter';
        g.shadowColor = lGlow;
        for (let li = 0; li < glowLayers; li++) {
          const t = glowLayers > 1 ? (li / (glowLayers - 1)) : 0;
          const alpha = 0.08 * (1 - t);
          g.shadowBlur = 8 + t * 10;
          g.fillStyle = `rgba(102,204,255,${alpha.toFixed(3)})`;
          g.fillText(lGlyph, cx, cy);
        }
      }
      g.globalCompositeOperation = 'source-over';
      g.shadowBlur = 0;
      g.fillStyle = lFg;
      g.fillText(lGlyph, cx, cy);
    }
    return;
  }

  const glyph = look.glyph || '?';
  const fg = look.fg || '#fff';
  const glow = look.glow || 'rgba(102,204,255,0.6)';
  g.font = `900 ${fontPx}px monospace`;

  if (includeBackground && look.bg) {
    g.fillStyle = look.bg;
    g.fillRect(0, 0, sizePx, sizePx);
  }

  if (glowLayers > 0) {
    g.globalCompositeOperation = 'lighter';
    g.shadowColor = glow;
    for (let li = 0; li < glowLayers; li++) {
      const t = glowLayers > 1 ? (li / (glowLayers - 1)) : 0;
      const alpha = 0.08 * (1 - t);
      g.shadowBlur = 8 + t * 10;
      g.fillStyle = `rgba(102,204,255,${alpha.toFixed(3)})`;
      g.fillText(glyph, sizePx * 0.5, sizePx * 0.5);
    }
  }

  g.globalCompositeOperation = 'source-over';
  g.shadowBlur = 0;
  g.fillStyle = fg;
  g.fillText(glyph, sizePx * 0.5, sizePx * 0.5);
}

export function drawKind(atlas, ctx, kind, x, y) {
  const entry = atlas.get(kind) || atlas.get('default');
  if (!entry || !entry.canvas) return;
  // Draw as 1x1 world unit centered at (x,y); camera transform scales to pixels
  ctx.drawImage(entry.canvas, x - 0.5, y - 0.5, 1, 1);
}

export function drawKindForeground(atlas, ctx, kind, x, y) {
  const entry = atlas.get(kind) || atlas.get('default');
  const canvas = entry?.fgCanvas || entry?.canvas;
  if (!canvas) return;
  ctx.drawImage(canvas, x - 0.5, y - 0.5, 1, 1);
}

export function drawKindScaled(atlas, ctx, kind, x, y, scale = 1, rotation = 0) {
  const entry = atlas.get(kind) || atlas.get('default');
  if (!entry || !entry.canvas) return;
  const s = Number(scale || 1);
  const r = Number(rotation || 0);
  if (Math.abs(s - 1) <= 0.001 && Math.abs(r) <= 0.001) {
    ctx.drawImage(entry.canvas, x - 0.5, y - 0.5, 1, 1);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  if (Math.abs(r) > 0.001) ctx.rotate(r);
  if (Math.abs(s - 1) > 0.001) ctx.scale(s, s);
  ctx.drawImage(entry.canvas, -0.5, -0.5, 1, 1);
  ctx.restore();
}

export function drawKindScaledForeground(atlas, ctx, kind, x, y, scale = 1, rotation = 0) {
  const entry = atlas.get(kind) || atlas.get('default');
  const canvas = entry?.fgCanvas || entry?.canvas;
  if (!canvas) return;
  const s = Number(scale || 1);
  const r = Number(rotation || 0);
  if (Math.abs(s - 1) <= 0.001 && Math.abs(r) <= 0.001) {
    ctx.drawImage(canvas, x - 0.5, y - 0.5, 1, 1);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  if (Math.abs(r) > 0.001) ctx.rotate(r);
  if (Math.abs(s - 1) > 0.001) ctx.scale(s, s);
  ctx.drawImage(canvas, -0.5, -0.5, 1, 1);
  ctx.restore();
}
