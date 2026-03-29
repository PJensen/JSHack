// display/lighting/engine.js
// Sub-tile SDF lighting engine.
// 8×8 lighting cells per game tile — smooth quadratic falloff, wall-face
// catch-lights via SDF normals.  Ported from js-hack-arena's torchPass and
// adapted to JSHack's discrete tile grid.

const SUB = 8;             // sub-cells per tile edge  (64 cells/tile)
const INV_SUB = 1 / SUB;   // tile-units per sub-cell
const SQRT2 = 1.4142;

/**
 * @typedef {{
 *   x: number,           // tile-space X (fractional OK)
 *   y: number,           // tile-space Y
 *   radius: number,      // falloff radius in tiles
 *   color?: [number, number, number],  // RGB 0-255, default warm orange
 *   flicker?: number     // 0-1 intensity multiplier (applied by caller)
 * }} LightDef
 */

/**
 * Create a self-contained lighting engine instance.
 * Manages its own off-screen canvas and typed-array buffers.
 */
export function createLightingEngine() {
  // ---- Buffers (resized lazily) ----------------------------------------
  let lmW = 0, lmH = 0;
  /** @type {Float32Array} */ let sdf   = null;
  /** @type {Float32Array} */ let normX = null;
  /** @type {Float32Array} */ let normY = null;
  /** @type {Float32Array} */ let lightR = null;
  /** @type {Float32Array} */ let lightG = null;
  /** @type {Float32Array} */ let lightB = null;

  const lmCanvas = document.createElement('canvas');
  const lmCtx    = lmCanvas.getContext('2d');
  /** @type {ImageData} */ let imgData = null;
  /** @type {Uint8ClampedArray} */ let pixels = null;

  // Viewport origin (tile ints) — kept for coordinate math in render().
  let _tx0 = 0, _ty0 = 0;

  /** Ensure buffers match the required sub-cell dimensions. */
  function ensureSize(tw, th) {
    const w = tw * SUB;
    const h = th * SUB;
    if (w === lmW && h === lmH) return;
    lmW = w; lmH = h;
    const n = w * h;
    sdf    = new Float32Array(n);
    normX  = new Float32Array(n);
    normY  = new Float32Array(n);
    lightR = new Float32Array(n);
    lightG = new Float32Array(n);
    lightB = new Float32Array(n);
    lmCanvas.width  = w;
    lmCanvas.height = h;
    imgData = lmCtx.createImageData(w, h);
    pixels  = imgData.data;
  }

  // ---- SDF construction ------------------------------------------------

  /**
   * Build an approximate SDF from tile opacity via two-pass Chamfer distance
   * transform.  Result is in *sub-cell* units (1 = one sub-cell width).
   *
   * @param {(x:number,y:number)=>boolean} isOpaque
   * @param {number} tx0 - viewport tile origin X
   * @param {number} ty0 - viewport tile origin Y
   * @param {number} tw  - viewport width in tiles
   * @param {number} th  - viewport height in tiles
   */
  function buildSDF(isOpaque, tx0, ty0, tw, th) {
    const w = tw * SUB, h = th * SUB;

    // Initialise: wall sub-cells = 0, open = large sentinel.
    for (let sy = 0; sy < h; sy++) {
      const tyi = ty0 + ((sy * INV_SUB) | 0);
      for (let sx = 0; sx < w; sx++) {
        const txi = tx0 + ((sx * INV_SUB) | 0);
        sdf[sy * w + sx] = isOpaque(txi, tyi) ? 0 : 9999;
      }
    }

    // Forward pass (top-left → bottom-right)
    for (let sy = 1; sy < h; sy++) {
      for (let sx = 1; sx < w - 1; sx++) {
        const i = sy * w + sx;
        if (sdf[i] === 0) continue;
        let m = sdf[i];
        const a = sdf[i - 1]     + 1;      if (a < m) m = a;
        const b = sdf[i - w]     + 1;      if (b < m) m = b;
        const c = sdf[i - w - 1] + SQRT2;  if (c < m) m = c;
        const d = sdf[i - w + 1] + SQRT2;  if (d < m) m = d;
        sdf[i] = m;
      }
    }

    // Backward pass (bottom-right → top-left)
    for (let sy = h - 2; sy >= 0; sy--) {
      for (let sx = w - 2; sx >= 1; sx--) {
        const i = sy * w + sx;
        if (sdf[i] === 0) continue;
        let m = sdf[i];
        const a = sdf[i + 1]     + 1;      if (a < m) m = a;
        const b = sdf[i + w]     + 1;      if (b < m) m = b;
        const c = sdf[i + w + 1] + SQRT2;  if (c < m) m = c;
        const d = sdf[i + w - 1] + SQRT2;  if (d < m) m = d;
        sdf[i] = m;
      }
    }

    // Normals from gradient (central differences)
    for (let sy = 1; sy < h - 1; sy++) {
      for (let sx = 1; sx < w - 1; sx++) {
        const i = sy * w + sx;
        const dx = sdf[i + 1] - sdf[i - 1];
        const dy = sdf[i + w] - sdf[i - w];
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        normX[i] = dx / len;
        normY[i] = dy / len;
      }
    }
  }

  // ---- Light accumulation ----------------------------------------------

  /**
   * Accumulate RGB contributions from all light sources into the lightR/G/B
   * buffers.  Works entirely in sub-cell space for the inner loop.
   *
   * @param {LightDef[]} lights
   * @param {[number,number,number]|null} ambient — RGB 0-1, added to every open cell
   */
  function accumulateLights(lights, ambient) {
    const w = lmW, h = lmH;
    const n = w * h;

    // Seed with ambient (sunlight / moonlight) if provided
    if (ambient && (ambient[0] > 0 || ambient[1] > 0 || ambient[2] > 0)) {
      const ar = ambient[0], ag = ambient[1], ab = ambient[2];
      for (let i = 0; i < n; i++) {
        if (sdf[i] > 0) { lightR[i] = ar; lightG[i] = ag; lightB[i] = ab; }
        else            { lightR[i] = 0;  lightG[i] = 0;  lightB[i] = 0;  }
      }
    } else {
      lightR.fill(0);
      lightG.fill(0);
      lightB.fill(0);
    }

    for (let li = 0; li < lights.length; li++) {
      const light = lights[li];
      const col = light.color || [255, 200, 140];
      const flicker = light.flicker ?? 1;
      const cr = (col[0] / 255) * flicker;
      const cg = (col[1] / 255) * flicker;
      const cb = (col[2] / 255) * flicker;
      const lr  = light.radius;          // tile units
      const lrSub = lr * SUB;            // sub-cell units
      const lrSub2 = lrSub * lrSub;
      const invLrSub = 1 / lrSub;

      // Light position in sub-cell coords (relative to lightmap origin)
      const lsx = (light.x - _tx0) * SUB;
      const lsy = (light.y - _ty0) * SUB;

      // Bounding rect in sub-cells
      const sx0 = Math.max(1,     (lsx - lrSub) | 0);
      const sy0 = Math.max(1,     (lsy - lrSub) | 0);
      const sx1 = Math.min(w - 2, (lsx + lrSub) | 0);
      const sy1 = Math.min(h - 2, (lsy + lrSub) | 0);

      for (let sy = sy0; sy <= sy1; sy++) {
        const dwy = sy - lsy;
        const dwy2 = dwy * dwy;
        const rowOff = sy * w;
        for (let sx = sx0; sx <= sx1; sx++) {
          const i = rowOff + sx;
          const d = sdf[i];
          if (d <= 0) continue;           // inside wall

          const dwx = sx - lsx;
          const dist2 = dwx * dwx + dwy2;
          if (dist2 > lrSub2) continue;

          const dist = Math.sqrt(dist2);
          const atten = 1.0 - dist * invLrSub;
          const atten2 = atten * atten;   // quadratic falloff

          // Near-wall diffuse catch-light (sub-cell threshold ≈ 0.5 tiles)
          const wallThresh = 4;
          let intensity;
          if (d < wallThresh) {
            const invDist = 1 / (dist || 1);
            const ldx = -dwx * invDist;
            const ldy = -dwy * invDist;
            const diffuse = Math.max(0, normX[i] * ldx + normY[i] * ldy);
            const wallBlend = 1.0 - d / wallThresh;
            intensity = (0.9 + diffuse * wallBlend * 0.5) * atten2;
          } else {
            intensity = 0.9 * atten2;
          }

          lightR[i] += cr * intensity;
          lightG[i] += cg * intensity;
          lightB[i] += cb * intensity;
        }
      }
    }
  }

  // ---- Render to canvas ------------------------------------------------

  /**
   * Compute lighting and composite the two-pass overlay onto `ctx`.
   *
   * @param {CanvasRenderingContext2D} ctx   — under camera/world transform
   * @param {LightDef[]} lights
   * @param {(x:number,y:number)=>boolean} isOpaque
   * @param {number} vx0  @param {number} vy0
   * @param {number} vx1  @param {number} vy1
   * @param {[number,number,number]|null} [ambient] — RGB 0-1 base light for every open cell
   * @param {number} [maxDark=140] — max darkness alpha (0=no overlay, 255=pure black)
   */
  function render(ctx, lights, isOpaque, vx0, vy0, vx1, vy1, ambient, maxDark) {
    const DARK = (maxDark != null) ? maxDark : 140;
    const tx0 = Math.floor(vx0) - 1;
    const ty0 = Math.floor(vy0) - 1;
    const tx1 = Math.ceil(vx1)  + 1;
    const ty1 = Math.ceil(vy1)  + 1;
    const tw  = tx1 - tx0;
    const th  = ty1 - ty0;
    if (tw <= 2 || th <= 2) return;

    ensureSize(tw, th);
    _tx0 = tx0; _ty0 = ty0;

    buildSDF(isOpaque, tx0, ty0, tw, th);
    accumulateLights(lights, ambient || null);

    const n = lmW * lmH;

    // ---- Pass 1: darkness overlay (source-over, black + alpha) ----------
    for (let i = 0; i < n; i++) {
      const pi = i << 2;
      pixels[pi]     = 0;
      pixels[pi + 1] = 0;
      pixels[pi + 2] = 0;
      if (sdf[i] <= 0) {
        pixels[pi + 3] = DARK;
      } else {
        const brightness = Math.min(1, (lightR[i] + lightG[i] + lightB[i]) * 0.5);
        pixels[pi + 3] = Math.max(0, (DARK - brightness * (DARK + 20)) | 0);
      }
    }
    lmCtx.putImageData(imgData, 0, 0);

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    // Each sub-cell maps to INV_SUB tiles; the full lightmap covers tw × th tiles.
    // Tiles are drawn centred on integer coords → tile tx0 occupies [tx0−0.5 .. tx0+0.5].
    ctx.drawImage(lmCanvas,
      0, 0, lmW, lmH,
      tx0 - 0.5, ty0 - 0.5, tw, th);
    ctx.restore();

    // ---- Pass 2: warm colour tint (additive via 'lighter') --------------
    for (let i = 0; i < n; i++) {
      const pi = i << 2;
      if (sdf[i] <= 0) {
        pixels[pi] = 0; pixels[pi + 1] = 0; pixels[pi + 2] = 0; pixels[pi + 3] = 0;
        continue;
      }
      const brightness = Math.min(1, (lightR[i] + lightG[i] + lightB[i]) * 0.4);
      pixels[pi]     = Math.min(255, (lightR[i] * 255) | 0);
      pixels[pi + 1] = Math.min(255, (lightG[i] * 180) | 0);
      pixels[pi + 2] = Math.min(255, (lightB[i] * 60)  | 0);
      pixels[pi + 3] = (brightness * 120) | 0;
    }
    lmCtx.putImageData(imgData, 0, 0);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(lmCanvas,
      0, 0, lmW, lmH,
      tx0 - 0.5, ty0 - 0.5, tw, th);
    ctx.restore();
  }

  return { render };
}
