// src/main/bootstrap/canvasSetup.js
// Canvas + backbuffer creation and DPR-aware resize handler.

/**
 * Create the main canvas, backbuffer, and DPR-aware resize handler.
 * @param {{ canvasId: string, TILE_PX: number, dprCap: number }} opts
 * @returns {{ canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D,
 *             back: HTMLCanvasElement, bctx: CanvasRenderingContext2D,
 *             cssW: number, cssH: number, dpr: number, resize: () => void }}
 */
export function createCanvasSetup({ canvasId, TILE_PX, dprCap }) {
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById(canvasId));
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = false;

  // Backbuffer mirrors DPR and presents once per frame (reduces state churn)
  const back = document.createElement('canvas');
  const bctx = back.getContext('2d', { alpha: false });
  bctx.imageSmoothingEnabled = false;

  const state = { canvas, ctx, back, bctx, cssW: 0, cssH: 0, dpr: 1, resize };

  function resize() {
    // Limit device pixel ratio and align CSS size to tile grid to avoid fractional resampling
    const rawDpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const maxCap = Math.max(1, Math.floor(dprCap || 1));
    const dpr = Math.max(1, Math.min(rawDpr, maxCap));

    const vw = Math.max(1, (window.innerWidth | 0));
    const vh = Math.max(1, (window.innerHeight | 0));
    const cols = Math.max(1, Math.floor(vw / TILE_PX));
    const rows = Math.max(1, Math.floor(vh / TILE_PX));
    const cssW = cols * TILE_PX;
    const cssH = rows * TILE_PX;

    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Backbuffer mirrors visible canvas size and DPR transform
    back.width = canvas.width;
    back.height = canvas.height;
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    state.cssW = cssW;
    state.cssH = cssH;
    state.dpr = dpr;
  }

  addEventListener("resize", resize);
  resize();

  return state;
}
