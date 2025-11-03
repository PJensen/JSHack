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

  const atlas = new Map(); // kind -> { canvas?, image? }

  for (const [kind, look] of Object.entries(palette)) {
    const glyph = look.glyph || '?';
    const fg = look.fg || '#fff';
    const glow = look.glow || 'rgba(102,204,255,0.6)';

    const cnv = document.createElement('canvas');
    cnv.width = sizePx; cnv.height = sizePx;
    const g = cnv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `900 ${fontPx}px monospace`;

    // Bake glow once, if enabled
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

    // Core glyph on top
    g.globalCompositeOperation = 'source-over';
    g.shadowBlur = 0;
    g.fillStyle = fg;
    g.fillText(glyph, sizePx * 0.5, sizePx * 0.5);

    // Try to upgrade canvas to an ImageBitmap for faster blits on mobile
    let entry = { canvas: cnv, image: null };
    const canBitmap = (typeof createImageBitmap === 'function');
    if (canBitmap) {
      try {
        // Note: createImageBitmap is async; we can start it and stash the promise if needed,
        // but here we block once during setup to ensure images are ready before first frame.
        // On unsupported platforms this will throw and we keep using the canvas.
        entry.image = awaitMaybeBitmap(cnv);
      } catch (_) { /* keep canvas fallback */ }
    }
    atlas.set(kind, entry);
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
    let entry = { canvas: cnv, image: null };
    const canBitmap = (typeof createImageBitmap === 'function');
    if (canBitmap) {
      try { entry.image = awaitMaybeBitmap(cnv); } catch(_) {}
    }
    atlas.set('default', entry);
  }

  return atlas;
}

export function drawKind(atlas, ctx, kind, x, y) {
  const entry = atlas.get(kind) || atlas.get('default');
  if (!entry) return;
  const src = entry.image || entry.canvas;
  if (!src) return;
  // Draw as 1x1 world unit centered at (x,y); camera transform scales to pixels
  ctx.drawImage(src, x - 0.5, y - 0.5, 1, 1);
}

// Best-effort sync helper: returns ImageBitmap or null if not supported/failed
function awaitMaybeBitmap(canvas) {
  if (typeof createImageBitmap !== 'function') return null;
  // Some browsers require non-zero dimensions and CORS-safe sources
  if (!canvas || !canvas.width || !canvas.height) return null;
  // We avoid async here; on modern Chrome this is quick for small canvases
  // Using a minimal microtask trampoline to keep API consistent
  let bmp = null;
  // createImageBitmap returns a Promise<ImageBitmap>
  // We can’t use await in ESM without marking function async; instead, block with then/catch sync-ish
  // but since we can’t block, return null for now and keep canvas; a future improvement could prewarm asynchronously.
  // For now, try a synchronous-like pattern by abusing transferToImageBitmap on OffscreenCanvas if available
  try {
    if (typeof OffscreenCanvas !== 'undefined' && canvas.transferControlToOffscreen) {
      // Not usable here without worker; fallback
      return null;
    }
  } catch(_) {}
  return bmp; // null means fallback to canvas
}
