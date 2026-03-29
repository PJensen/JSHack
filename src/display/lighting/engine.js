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
 * Vision mask — NOT a light.  Controls what the player can perceive (lifts
 * darkness) without emitting colour or creating halos.
 * @typedef {{
 *   x: number,           // tile-space X (fractional, tile-center)
 *   y: number,           // tile-space Y
 *   radius: number,      // max sight distance in tiles (smoothed)
 *   facingX?: number,    // unit-direction X (null/0 = omnidirectional)
 *   facingY?: number,    // unit-direction Y
 *   coneDeg?: number,    // total cone width in degrees (360 = full circle)
 *   penumbraDeg?: number // soft edge width in degrees (default 25)
 * }} VisionDef
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
  /** @type {Float32Array} */ let vision = null;  // 0 = unseen, 1 = full sight

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
    vision = new Float32Array(n);
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

  // ---- Vision mask construction -----------------------------------------

  /**
   * Build the vision mask: a smooth 0-1 buffer indicating how well the player
   * can perceive each sub-cell.  This is NOT illumination — it only controls
   * whether the darkness overlay is lifted so the player can see what's there.
   *
   * Supports both omnidirectional (360°) and directional cone vision with
   * smooth penumbra edges.  Wall occlusion is handled via SDF ray-march.
   *
   * @param {VisionDef|null} visionDef
   */
  function buildVision(visionDef) {
    const w = lmW, h = lmH;
    vision.fill(0);
    if (!visionDef || visionDef.radius <= 0) return;

    const vr = visionDef.radius;
    const vrSub = vr * SUB;
    const vrSub2 = vrSub * vrSub;
    const invVrSub = 1 / vrSub;

    // Player position in sub-cell space
    const psx = (visionDef.x - _tx0) * SUB;
    const psy = (visionDef.y - _ty0) * SUB;

    // Cone parameters
    const coneDeg = visionDef.coneDeg || 360;
    const hasCone = coneDeg < 359;
    const penumbraDeg = visionDef.penumbraDeg || 25;
    const halfConeRad = (coneDeg * 0.5) * (Math.PI / 180);
    const penumbraRad = penumbraDeg * (Math.PI / 180);
    const fx = visionDef.facingX || 0;
    const fy = visionDef.facingY || 0;

    // Bounding rect
    const sx0 = Math.max(1,     (psx - vrSub) | 0);
    const sy0 = Math.max(1,     (psy - vrSub) | 0);
    const sx1 = Math.min(w - 2, (psx + vrSub) | 0);
    const sy1 = Math.min(h - 2, (psy + vrSub) | 0);

    for (let sy = sy0; sy <= sy1; sy++) {
      const dy = sy - psy;
      const dy2 = dy * dy;
      const rowOff = sy * w;
      for (let sx = sx0; sx <= sx1; sx++) {
        const i = rowOff + sx;
        if (sdf[i] <= 0) continue;  // inside wall

        const dx = sx - psx;
        const dist2 = dx * dx + dy2;
        if (dist2 > vrSub2) continue;

        // Wall occlusion
        if (!rayVisible(psx, psy, sx, sy, w)) continue;

        // Distance falloff — smooth fade over last 1.5 tiles
        const dist = Math.sqrt(dist2);
        const edgeFade = 1.5 * SUB;  // fade zone width in sub-cells
        let v = 1.0;
        if (dist > vrSub - edgeFade) {
          v = Math.max(0, (vrSub - dist) / edgeFade);
          v = v * v * (3 - 2 * v);  // smoothstep
        }

        // Cone attenuation — applied everywhere except the player's own tile
        if (hasCone && dist > SUB * 0.5) {
          const angle = Math.atan2(dy, dx);
          const facingAngle = Math.atan2(fy, fx);
          let diff = angle - facingAngle;
          // Normalize to [-PI, PI]
          if (diff > Math.PI) diff -= 2 * Math.PI;
          if (diff < -Math.PI) diff += 2 * Math.PI;
          const absDiff = Math.abs(diff);

          if (absDiff > halfConeRad + penumbraRad) {
            continue;  // fully outside cone + penumbra
          } else if (absDiff > halfConeRad) {
            // In penumbra — smooth falloff
            const penT = 1.0 - (absDiff - halfConeRad) / penumbraRad;
            v *= penT * penT * (3 - 2 * penT);  // smoothstep
          }
        }

        vision[i] = v;
      }
    }
  }

  // ---- SDF ray-march (sphere tracing) for shadow occlusion --------------

  /**
   * March a ray from (ox, oy) toward (tx, ty) in sub-cell space.
   * Returns true if the path is unoccluded (visible), false if a wall blocks it.
   *
   * Uses sphere-tracing: at each step, advance by the SDF distance at the
   * current sample point.  If the SDF drops below the hit threshold, the ray
   * has struck a wall.  Typical iteration count is 4-12 in corridors, 2-4 in
   * open rooms — driven by how large the SDF values are in open space.
   */
  function rayVisible(ox, oy, tx, ty, w) {
    const dx = tx - ox;
    const dy = ty - oy;
    const totalDist = Math.sqrt(dx * dx + dy * dy);
    if (totalDist < 1.5) return true;       // adjacent cells — always visible

    const invDist = 1 / totalDist;
    const rdx = dx * invDist;               // unit direction
    const rdy = dy * invDist;

    const HIT    = 0.45;   // SDF below this = inside wall
    const MIN_STEP = 0.7;  // don't crawl — ensure forward progress
    const MAX_STEPS = 24;  // hard cap (generous; typical is 4-12)

    let t = 1.0;  // start slightly away from light centre
    for (let step = 0; step < MAX_STEPS; step++) {
      const cx = ox + rdx * t;
      const cy = oy + rdy * t;

      // Sample SDF via nearest-neighbour (fast integer lookup)
      const si = (cx + 0.5) | 0;
      const sj = (cy + 0.5) | 0;
      if (si < 0 || si >= w || sj < 0 || sj >= lmH) return false;  // off-grid = blocked

      const d = sdf[sj * w + si];
      if (d < HIT) return false;             // hit a wall

      t += Math.max(d, MIN_STEP);
      if (t >= totalDist - 0.5) return true; // reached the target
    }

    return true;  // ran out of steps — assume visible (rare, open space)
  }

  // ---- Light accumulation ----------------------------------------------

  /**
   * Accumulate RGB contributions from all light sources into the lightR/G/B
   * buffers.  Works entirely in sub-cell space for the inner loop.
   *
   * @param {LightDef[]} lights
   * @param {[number,number,number]|null} ambient — RGB 0-1, added to every open cell
   * @param {((x:number,y:number)=>boolean)|null} [isRoofed] — if provided, roofed cells receive no ambient (sky blocked by roof)
   */
  function accumulateLights(lights, ambient, isRoofed) {
    const w = lmW, h = lmH;
    const n = w * h;

    // Seed with ambient (sunlight / moonlight) if provided.
    // Roofed cells are excluded — the sky can't reach under a roof.
    if (ambient && (ambient[0] > 0 || ambient[1] > 0 || ambient[2] > 0)) {
      const ar = ambient[0], ag = ambient[1], ab = ambient[2];
      if (isRoofed) {
        for (let sy = 0; sy < h; sy++) {
          const ty = _ty0 + ((sy * INV_SUB) | 0);
          const rowOff = sy * w;
          for (let sx = 0; sx < w; sx++) {
            const i = rowOff + sx;
            if (sdf[i] > 0 && !isRoofed(_tx0 + ((sx * INV_SUB) | 0), ty)) {
              lightR[i] = ar; lightG[i] = ag; lightB[i] = ab;
            } else {
              lightR[i] = 0; lightG[i] = 0; lightB[i] = 0;
            }
          }
        }
      } else {
        for (let i = 0; i < n; i++) {
          if (sdf[i] > 0) { lightR[i] = ar; lightG[i] = ag; lightB[i] = ab; }
          else            { lightR[i] = 0;  lightG[i] = 0;  lightB[i] = 0;  }
        }
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

          // SDF ray-march: skip cell if a wall blocks line-of-sight from light
          if (!rayVisible(lsx, lsy, sx, sy, w)) continue;

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
   * @param {((x:number,y:number)=>boolean)|null} [isRoofed] — roofed cells get no ambient
   * @param {VisionDef|null} [visionDef] — player vision mask (not a light)
   */
  function render(ctx, lights, isOpaque, vx0, vy0, vx1, vy1, ambient, maxDark, isRoofed, visionDef) {
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
    buildVision(visionDef || null);
    accumulateLights(lights, ambient || null, isRoofed || null);

    const n = lmW * lmH;

    // ---- Pass 1: darkness overlay (source-over, black + alpha) ----------
    // Vision mask lifts darkness (lets you see) without adding colour.
    // Lights also lift darkness AND add colour in pass 2.
    for (let i = 0; i < n; i++) {
      const pi = i << 2;
      pixels[pi]     = 0;
      pixels[pi + 1] = 0;
      pixels[pi + 2] = 0;
      if (sdf[i] <= 0) {
        pixels[pi + 3] = DARK;
      } else {
        const brightness = Math.min(1, (lightR[i] + lightG[i] + lightB[i]) * 0.5);
        const sight = vision[i];  // 0-1 vision mask
        // Vision lifts darkness to reveal what's there; light lifts further
        const visLift = sight * 0.85;  // vision alone doesn't fully clear darkness
        const lightLift = brightness;
        const totalLift = Math.min(1, visLift + lightLift);
        pixels[pi + 3] = Math.max(0, (DARK * (1 - totalLift)) | 0);
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
