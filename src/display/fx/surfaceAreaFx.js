// display/fx/surfaceAreaFx.js
// Fixed-hull terrain surface FX for water and lava.

function cellKey(x, y) {
  return `${x},${y}`;
}

function pointKey(x, y) {
  return `${x}:${y}`;
}

function midpoint(a, b) {
  return { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
}

function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

function hash32(a, b = 0, c = 0, d = 0) {
  let h = 2166136261 >>> 0;
  h ^= a | 0; h = Math.imul(h, 16777619);
  h ^= b | 0; h = Math.imul(h, 16777619);
  h ^= c | 0; h = Math.imul(h, 16777619);
  h ^= d | 0; h = Math.imul(h, 16777619);
  return h >>> 0;
}

function toneBase(family, tone) {
  if (family === "lava") {
    return tone === "bright"
      ? "rgba(210,92,24,0.38)"
      : "rgba(132,42,10,0.42)";
  }
  if (tone === "deep") return "rgba(20,64,126,0.42)";
  if (tone === "shallow") return "rgba(56,144,176,0.28)";
  return "rgba(34,104,156,0.34)";
}

function toneGlow(family, tone) {
  if (family === "lava") {
    return tone === "bright"
      ? "rgba(255,208,120,0.20)"
      : "rgba(255,130,48,0.16)";
  }
  if (tone === "deep") return "rgba(96,168,255,0.10)";
  if (tone === "shallow") return "rgba(170,236,255,0.12)";
  return "rgba(126,206,255,0.11)";
}

/**
 * Build contour loops around a tile union.
 * @param {Set<string>} cellKeys
 * @returns {Array<Array<{x:number,y:number}>>}
 */
export function buildSurfaceHullLoops(cellKeys) {
  const addEdge = (edges, x0, y0, x1, y1) => {
    edges.push({
      start: { x: x0, y: y0 },
      end: { x: x1, y: y1 },
      startKey: pointKey(x0, y0),
      endKey: pointKey(x1, y1),
    });
  };

  /** @type {Array<{start:{x:number,y:number}, end:{x:number,y:number}, startKey:string, endKey:string}>} */
  const edges = [];
  for (const key of cellKeys) {
    const [x, y] = key.split(",").map(Number);
    const left = x - 0.5;
    const right = x + 0.5;
    const top = y - 0.5;
    const bottom = y + 0.5;
    if (!cellKeys.has(cellKey(x, y - 1))) addEdge(edges, left, top, right, top);
    if (!cellKeys.has(cellKey(x + 1, y))) addEdge(edges, right, top, right, bottom);
    if (!cellKeys.has(cellKey(x, y + 1))) addEdge(edges, right, bottom, left, bottom);
    if (!cellKeys.has(cellKey(x - 1, y))) addEdge(edges, left, bottom, left, top);
  }

  /** @type {Map<string, Array<{start:{x:number,y:number}, end:{x:number,y:number}, startKey:string, endKey:string}>>} */
  const outgoing = new Map();
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    let list = outgoing.get(edge.startKey);
    if (!list) {
      list = [];
      outgoing.set(edge.startKey, list);
    }
    list.push(edge);
  }

  const takeEdge = (startKey) => {
    const list = outgoing.get(startKey);
    if (!list || list.length === 0) return null;
    const edge = list.pop() || null;
    if (list.length === 0) outgoing.delete(startKey);
    return edge;
  };

  /** @type {Array<Array<{x:number,y:number}>>} */
  const loops = [];
  while (outgoing.size > 0) {
    const firstKey = outgoing.keys().next().value;
    const first = takeEdge(firstKey);
    if (!first) break;
    const loop = [first.start];
    let edge = first;
    let guard = edges.length + 4;
    while (edge && guard-- > 0) {
      loop.push(edge.end);
      if (edge.endKey === first.startKey) break;
      edge = takeEdge(edge.endKey);
    }
    if (loop.length >= 4) loops.push(loop);
  }
  return loops;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<Array<{x:number,y:number}>>} loops
 */
export function traceSurfaceHullPath(ctx, loops) {
  if (!ctx || !Array.isArray(loops) || loops.length === 0) return;
  ctx.beginPath();
  for (let i = 0; i < loops.length; i++) {
    const loop = loops[i];
    if (!Array.isArray(loop) || loop.length < 4) continue;
    const pts = loop[0].x === loop[loop.length - 1].x && loop[0].y === loop[loop.length - 1].y
      ? loop.slice(0, -1)
      : loop.slice();
    if (pts.length < 3) continue;
    const startMid = midpoint(pts[pts.length - 1], pts[0]);
    ctx.moveTo(startMid.x, startMid.y);
    for (let j = 0; j < pts.length; j++) {
      const curr = pts[j];
      const next = pts[(j + 1) % pts.length];
      const end = midpoint(curr, next);
      ctx.quadraticCurveTo(curr.x, curr.y, end.x, end.y);
    }
    ctx.closePath();
  }
}

/**
 * @param {{ tileGrid:any, isVisible?: ((x:number,y:number)=>boolean)|null }} worldView
 * @param {{ vx0:number, vy0:number, vx1:number, vy1:number }} viewport
 * @param {(tile:number) => ({ family:string, tone?:string } | null)} classifySurfaceTile
 */
export function extractSurfaceRegions(worldView, viewport, classifySurfaceTile) {
  if (!worldView?.tileGrid || typeof classifySurfaceTile !== "function") return [];
  const tx0 = Math.floor(Number(viewport?.vx0) || 0);
  const ty0 = Math.floor(Number(viewport?.vy0) || 0);
  const tx1 = Math.ceil(Number(viewport?.vx1) || 0);
  const ty1 = Math.ceil(Number(viewport?.vy1) || 0);
  const isVisible = typeof worldView.isVisible === "function" ? worldView.isVisible : null;

  /** @type {Map<string, Map<string, { key:string, x:number, y:number, family:string, tone:string }>>} */
  const families = new Map();
  worldView.tileGrid.forEachTileInRect(tx0, ty0, tx1, ty1, (x, y, tile) => {
    if (isVisible && !isVisible(x, y)) return;
    const surface = classifySurfaceTile(tile);
    if (!surface?.family) return;
    const family = String(surface.family || "").toLowerCase();
    if (!family) return;
    const tone = String(surface.tone || family).toLowerCase();
    let cells = families.get(family);
    if (!cells) {
      cells = new Map();
      families.set(family, cells);
    }
    cells.set(cellKey(x, y), { key: cellKey(x, y), x, y, family, tone });
  });

  /** @type {Array<{ family:string, cells:Array<{ key:string, x:number, y:number, family:string, tone:string }>, cellKeys:Set<string>, loops:Array<Array<{x:number,y:number}>>, bounds:{ minX:number, minY:number, maxX:number, maxY:number }, area:number, seed:number }>} */
  const regions = [];

  for (const [family, cells] of families) {
    const unvisited = new Set(cells.keys());
    while (unvisited.size > 0) {
      const startKey = unvisited.keys().next().value;
      const queue = [startKey];
      const regionKeys = new Set();
      /** @type {Array<{ key:string, x:number, y:number, family:string, tone:string }>} */
      const regionCells = [];
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      while (queue.length > 0) {
        const key = queue.pop();
        if (!unvisited.has(key)) continue;
        unvisited.delete(key);
        regionKeys.add(key);
        const cell = cells.get(key);
        if (!cell) continue;
        regionCells.push(cell);
        if (cell.x < minX) minX = cell.x;
        if (cell.y < minY) minY = cell.y;
        if (cell.x > maxX) maxX = cell.x;
        if (cell.y > maxY) maxY = cell.y;

        const nx = cell.x;
        const ny = cell.y;
        const neighbors = [
          cellKey(nx + 1, ny),
          cellKey(nx - 1, ny),
          cellKey(nx, ny + 1),
          cellKey(nx, ny - 1),
        ];
        for (let i = 0; i < neighbors.length; i++) {
          if (unvisited.has(neighbors[i])) queue.push(neighbors[i]);
        }
      }

      const seed = hash32(minX, minY, maxX, maxY ^ regionCells.length);
      regions.push({
        family,
        cells: regionCells,
        cellKeys: regionKeys,
        loops: buildSurfaceHullLoops(regionKeys),
        bounds: { minX: minX - 0.5, minY: minY - 0.5, maxX: maxX + 0.5, maxY: maxY + 0.5 },
        area: regionCells.length,
        seed,
      });
    }
  }

  return regions;
}

function drawSoftEllipse(ctx, x, y, rx, ry) {
  if (typeof ctx.ellipse === "function") {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.arc(x, y, Math.max(rx, ry), 0, Math.PI * 2);
  ctx.fill();
}

function drawWaterRegion(ctx, region, fxTime, ripples, quality) {
  const { bounds, cells, loops, seed } = region;
  const pulse = 0.5 + 0.5 * Math.sin(fxTime * 1.8 + (seed & 255) * 0.021);
  const drift = fxTime * 1.25 + (seed & 1023) * 0.009;
  const shimmerLines = quality === "low" ? 4 : Math.max(6, Math.min(14, Math.round((bounds.maxY - bounds.minY) * 2.6)));

  ctx.save();
  traceSurfaceHullPath(ctx, loops);
  ctx.clip();

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    ctx.fillStyle = toneBase("water", cell.tone);
    ctx.fillRect(cell.x - 0.5, cell.y - 0.5, 1, 1);
    ctx.fillStyle = toneGlow("water", cell.tone);
    drawSoftEllipse(ctx, cell.x, cell.y + 0.08, 0.46, 0.32);
  }

  const grad = ctx.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  grad.addColorStop(0, "rgba(118,210,255,0.08)");
  grad.addColorStop(0.5, "rgba(36,96,160,0.02)");
  grad.addColorStop(1, "rgba(8,30,90,0.14)");
  ctx.fillStyle = grad;
  ctx.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (let i = 0; i < shimmerLines; i++) {
    const t = shimmerLines <= 1 ? 0 : i / (shimmerLines - 1);
    const y = bounds.minY + t * (bounds.maxY - bounds.minY) + Math.sin(drift + i * 0.8) * 0.06;
    const startX = bounds.minX - 0.6;
    const endX = bounds.maxX + 0.6;
    const w1 = Math.sin(drift * 1.7 + i * 0.9) * 0.24;
    const w2 = Math.sin(drift * 2.1 + i * 1.3 + 0.8) * 0.18;
    ctx.strokeStyle = `rgba(210,245,255,${(0.05 + pulse * 0.06).toFixed(3)})`;
    ctx.lineWidth = 0.05 + pulse * 0.025;
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.quadraticCurveTo(
      bounds.minX + (bounds.maxX - bounds.minX) * 0.33,
      y + w1,
      bounds.minX + (bounds.maxX - bounds.minX) * 0.66,
      y + w2,
    );
    ctx.quadraticCurveTo(
      bounds.minX + (bounds.maxX - bounds.minX) * 0.86,
      y - w1 * 0.5,
      endX,
      y + w2 * 0.3,
    );
    ctx.stroke();
  }

  const glintCount = quality === "low" ? 1 : Math.max(1, Math.min(4, Math.round(region.area / 8)));
  for (let i = 0; i < glintCount; i++) {
    const phase = drift * (0.8 + i * 0.09) + i * 1.7;
    const gx = bounds.minX + 0.4 + clamp01(0.5 + 0.5 * Math.sin(phase)) * Math.max(0.2, (bounds.maxX - bounds.minX) - 0.8);
    const gy = bounds.minY + 0.4 + clamp01(0.5 + 0.5 * Math.cos(phase * 0.7 + 1.1)) * Math.max(0.2, (bounds.maxY - bounds.minY) - 0.8);
    ctx.fillStyle = `rgba(230,250,255,${(0.05 + pulse * 0.08).toFixed(3)})`;
    drawSoftEllipse(ctx, gx, gy, 0.16, 0.05 + pulse * 0.015);
  }

  if (ripples.length > 0) {
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < ripples.length; i++) {
      const ripple = ripples[i];
      const p = ripple.max > 0 ? 1 - (ripple.ttl / ripple.max) : 1;
      const alpha = Math.max(0, (1 - p) * ripple.alpha);
      if (alpha <= 0.003) continue;
      const radius = ripple.radius0 + (ripple.radius1 - ripple.radius0) * p;
      ctx.strokeStyle = `rgba(220,246,255,${alpha.toFixed(3)})`;
      ctx.lineWidth = 0.035 + (1 - p) * 0.015;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(120,190,255,${(alpha * 0.55).toFixed(3)})`;
      ctx.lineWidth = 0.022;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, Math.max(0.02, radius * 0.62), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "rgba(210,244,255,0.24)";
  ctx.lineWidth = 0.075;
  traceSurfaceHullPath(ctx, loops);
  ctx.stroke();
  ctx.strokeStyle = "rgba(44,118,170,0.20)";
  ctx.lineWidth = 0.03;
  traceSurfaceHullPath(ctx, loops);
  ctx.stroke();
  ctx.restore();
}

function drawLavaRegion(ctx, region, fxTime, quality) {
  const { bounds, cells, loops, seed } = region;
  const boil = 0.5 + 0.5 * Math.sin(fxTime * 2.0 + (seed & 511) * 0.013);
  const drift = fxTime * 0.85 + (seed & 255) * 0.016;
  const bandCount = quality === "low" ? 3 : Math.max(5, Math.min(10, Math.round((bounds.maxY - bounds.minY) * 2.1)));

  ctx.save();
  traceSurfaceHullPath(ctx, loops);
  ctx.clip();

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    ctx.fillStyle = toneBase("lava", cell.tone);
    ctx.fillRect(cell.x - 0.5, cell.y - 0.5, 1, 1);
    ctx.fillStyle = toneGlow("lava", cell.tone);
    drawSoftEllipse(ctx, cell.x, cell.y + 0.06, 0.42, 0.28);
  }

  const baseGlow = ctx.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  baseGlow.addColorStop(0, "rgba(255,120,44,0.12)");
  baseGlow.addColorStop(0.5, "rgba(160,48,12,0.05)");
  baseGlow.addColorStop(1, "rgba(60,8,0,0.18)");
  ctx.fillStyle = baseGlow;
  ctx.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (let i = 0; i < bandCount; i++) {
    const t = bandCount <= 1 ? 0 : i / (bandCount - 1);
    const y = bounds.minY + t * (bounds.maxY - bounds.minY);
    const glowA = 0.04 + boil * 0.10;
    ctx.strokeStyle = `rgba(255,196,110,${glowA.toFixed(3)})`;
    ctx.lineWidth = 0.07 + boil * 0.02;
    ctx.beginPath();
    ctx.moveTo(bounds.minX - 0.4, y + Math.sin(drift + i) * 0.10);
    ctx.quadraticCurveTo(
      bounds.minX + (bounds.maxX - bounds.minX) * 0.40,
      y + Math.sin(drift * 1.4 + i * 1.2) * 0.22,
      bounds.maxX + 0.4,
      y + Math.cos(drift * 1.1 + i * 0.8) * 0.12,
    );
    ctx.stroke();
  }

  const hotSpots = quality === "low" ? 2 : Math.max(2, Math.min(6, Math.round(region.area / 7)));
  for (let i = 0; i < hotSpots; i++) {
    const phase = drift + i * 1.9;
    const gx = bounds.minX + 0.4 + clamp01(0.5 + 0.5 * Math.sin(phase)) * Math.max(0.25, (bounds.maxX - bounds.minX) - 0.8);
    const gy = bounds.minY + 0.4 + clamp01(0.5 + 0.5 * Math.cos(phase * 0.83 + 0.4)) * Math.max(0.25, (bounds.maxY - bounds.minY) - 0.8);
    ctx.fillStyle = `rgba(255,228,140,${(0.06 + boil * 0.10).toFixed(3)})`;
    drawSoftEllipse(ctx, gx, gy, 0.12 + boil * 0.05, 0.06 + boil * 0.03);
  }

  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "rgba(255,184,104,0.26)";
  ctx.lineWidth = 0.08;
  traceSurfaceHullPath(ctx, loops);
  ctx.stroke();
  ctx.strokeStyle = "rgba(104,18,0,0.24)";
  ctx.lineWidth = 0.03;
  traceSurfaceHullPath(ctx, loops);
  ctx.stroke();
  ctx.restore();
}

/**
 * @param {{ getFxTime: () => number, classifySurfaceTile: (tile:number) => ({ family:string, tone?:string } | null), PERF?: { quality?: string } }} deps
 */
export function createSurfaceAreaFxController({ getFxTime, classifySurfaceTile, PERF }) {
  /** @type {ReturnType<typeof extractSurfaceRegions>} */
  let _regions = [];
  /** @type {Array<{ x:number, y:number, ttl:number, max:number, radius0:number, radius1:number, alpha:number, cellKey:string }>} */
  let _waterRipples = [];
  let _rainAccum = 0;

  function tick(dtSec, worldView, viewport, weather) {
    _regions = extractSurfaceRegions(worldView, viewport, classifySurfaceTile);

    /** @type {Set<string>} */
    const waterKeys = new Set();
    /** @type {Array<{ key:string, x:number, y:number, family:string, tone:string }>} */
    const waterCells = [];
    for (let i = 0; i < _regions.length; i++) {
      const region = _regions[i];
      if (region.family !== "water") continue;
      for (let j = 0; j < region.cells.length; j++) {
        const cell = region.cells[j];
        waterKeys.add(cell.key);
        waterCells.push(cell);
      }
    }

    const nextRipples = [];
    for (let i = 0; i < _waterRipples.length; i++) {
      const ripple = _waterRipples[i];
      ripple.ttl -= dtSec;
      if (ripple.ttl <= 0) continue;
      if (!waterKeys.has(ripple.cellKey)) continue;
      nextRipples.push(ripple);
    }
    _waterRipples = nextRipples;

    if ((weather !== "rain" && weather !== "heavy_rain") || waterCells.length === 0) {
      _rainAccum = 0;
      return;
    }

    const baseRate = weather === "heavy_rain" ? 0.10 : 0.05;
    const rate = Math.min(18, waterCells.length * baseRate);
    _rainAccum += Math.max(0, Number(dtSec) || 0) * rate;

    const rippleBudget = weather === "heavy_rain" ? 48 : 28;
    while (_rainAccum >= 1) {
      _rainAccum -= 1;
      const cell = waterCells[(Math.random() * waterCells.length) | 0];
      if (!cell) break;
      _waterRipples.push({
        x: cell.x + 0.2 + Math.random() * 0.6,
        y: cell.y + 0.18 + Math.random() * 0.64,
        ttl: 0.34 + Math.random() * 0.20,
        max: 0.34 + Math.random() * 0.20,
        radius0: 0.02 + Math.random() * 0.04,
        radius1: 0.14 + Math.random() * 0.22,
        alpha: weather === "heavy_rain" ? 0.28 : 0.20,
        cellKey: cell.key,
      });
      if (_waterRipples.length > rippleBudget) {
        _waterRipples.splice(0, _waterRipples.length - rippleBudget);
      }
    }
  }

  function draw(ctx) {
    if (!_regions.length) return;
    const quality = String(PERF?.quality || "auto").toLowerCase();
    const fxTime = typeof getFxTime === "function" ? Number(getFxTime()) || 0 : 0;
    for (let i = 0; i < _regions.length; i++) {
      const region = _regions[i];
      if (!region.loops.length) continue;
      if (region.family === "water") {
        const ripples = [];
        for (let j = 0; j < _waterRipples.length; j++) {
          const ripple = _waterRipples[j];
          if (region.cellKeys.has(ripple.cellKey)) ripples.push(ripple);
        }
        drawWaterRegion(ctx, region, fxTime, ripples, quality);
        continue;
      }
      if (region.family === "lava") {
        drawLavaRegion(ctx, region, fxTime, quality);
      }
    }
  }

  return { tick, draw };
}
