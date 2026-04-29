// display/fx/surfaceAreaFx.js
// Fixed-hull terrain surface FX for water and lava.

import { Particle } from "../passes/vfx/particles/particlePool.js";

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

function rippleProgress(ripple) {
  return ripple?.max > 0 ? clamp01(1 - (ripple.ttl / ripple.max)) : 1;
}

function drawWaterRipple(ctx, ripple, alphaScale = 1) {
  const p = rippleProgress(ripple);
  const alpha = Math.max(0, (1 - p) * Number(ripple.alpha || 0) * alphaScale);
  if (alpha <= 0.003) return;
  const radius = Math.max(0, Number(ripple.radius0 || 0) + (Number(ripple.radius1 || 0) - Number(ripple.radius0 || 0)) * p);
  const rings = Math.max(2, Number(ripple.rings || 2) | 0);
  ctx.strokeStyle = rings >= 3
    ? `rgba(235,252,255,${alpha.toFixed(3)})`
    : `rgba(220,246,255,${alpha.toFixed(3)})`;
  ctx.lineWidth = rings >= 3 ? 0.050 + (1 - p) * 0.020 : 0.035 + (1 - p) * 0.015;
  ctx.beginPath();
  ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = rings >= 3
    ? `rgba(135,210,255,${(alpha * 0.70).toFixed(3)})`
    : `rgba(120,190,255,${(alpha * 0.55).toFixed(3)})`;
  ctx.lineWidth = rings >= 3 ? 0.034 : 0.022;
  ctx.beginPath();
  ctx.arc(ripple.x, ripple.y, Math.max(0.02, radius * 0.62), 0, Math.PI * 2);
  ctx.stroke();

  if (rings >= 3) {
    ctx.strokeStyle = `rgba(255,255,255,${(alpha * 0.42).toFixed(3)})`;
    ctx.lineWidth = 0.020;
    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, Math.max(0.015, radius * 0.34), 0, Math.PI * 2);
    ctx.stroke();
  }
}

function spawnWaterImpactRipple(out, cell, { alpha = 0.20, rings = 2 } = {}) {
  if (!out || !cell) return;
  const life = 0.34 + Math.random() * 0.20;
  out.push({
    x: cell.x + 0.2 + Math.random() * 0.6,
    y: cell.y + 0.18 + Math.random() * 0.64,
    ttl: life,
    max: life,
    radius0: 0.02 + Math.random() * 0.04,
    radius1: 0.14 + Math.random() * 0.22,
    alpha,
    cellKey: cell.key,
    rings,
  });
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
 * Sample a random world-space point on a hull loop's quadratic Bezier path.
 * Same curve construction as traceSurfaceHullPath: midpoints as endpoints,
 * corner vertices as quadratic control points.
 * @param {Array<{x:number,y:number}>} loop
 * @returns {{x:number, y:number, nx:number, ny:number}}
 */
function sampleBezierHullPoint(loop) {
  const raw = loop[0].x === loop[loop.length - 1].x &&
              loop[0].y === loop[loop.length - 1].y
    ? loop.slice(0, -1) : loop;
  if (raw.length < 3) return { x: raw[0].x, y: raw[0].y, nx: 0, ny: -1 };
  const segIdx = (Math.random() * raw.length) | 0;
  const ctrl = raw[segIdx];
  const prevPt = raw[(segIdx - 1 + raw.length) % raw.length];
  const nextPt = raw[(segIdx + 1) % raw.length];
  const startMid = { x: (prevPt.x + ctrl.x) * 0.5, y: (prevPt.y + ctrl.y) * 0.5 };
  const endMid = { x: (ctrl.x + nextPt.x) * 0.5, y: (ctrl.y + nextPt.y) * 0.5 };
  const t = Math.random();
  const u = 1 - t;
  const px = u * u * startMid.x + 2 * u * t * ctrl.x + t * t * endMid.x;
  const py = u * u * startMid.y + 2 * u * t * ctrl.y + t * t * endMid.y;
  const tx = 2 * (u * (ctrl.x - startMid.x) + t * (endMid.x - ctrl.x));
  const ty = 2 * (u * (ctrl.y - startMid.y) + t * (endMid.y - ctrl.y));
  const tlen = Math.sqrt(tx * tx + ty * ty) || 1;
  return { x: px, y: py, nx: -ty / tlen, ny: tx / tlen };
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
      drawWaterRipple(ctx, ripple, ripple.rings >= 3 ? 1 : 0.55);
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
 * @param {{ getFxTime: () => number, classifySurfaceTile: (tile:number) => ({ family:string, tone?:string } | null), fx?: any, PERF?: { quality?: string } }} deps
 */
export function createSurfaceAreaFxController({ getFxTime, classifySurfaceTile, fx, PERF }) {
  /** @type {ReturnType<typeof extractSurfaceRegions>} */
  let _regions = [];
  let _regionCacheKey = "";
  /** @type {Array<{ x:number, y:number, ttl:number, max:number, radius0:number, radius1:number, alpha:number, cellKey:string, rings?:number }>} */
  let _waterRipples = [];
  let _rainAccum = 0;
  const _fisheryRippleAccum = new Map();

  // Lava particles
  /** @type {Array<{ x:number, y:number, r:number, ttl:number, max:number, cellKey:string }>} */
  let _lavaBubbles = [];
  /** @type {Array<{ x:number, y:number, vx:number, vy:number, ttl:number, max:number, size:number }>} */
  let _lavaFireballs = [];
  /** @type {Array<{ x:number, y:number, vx:number, vy:number, ay:number, ttl:number, max:number, radius:number }>} */
  let _lavaEmberLights = [];
  /** @type {Array<{ x:number, y:number, vx:number, vy:number, ay:number, ttl:number, max:number, radius:number }>} */
  let _lavaGlowLights = [];
  /** @type {Array<{ x:number, y:number, radius:number, phase:number, pulse:number }>} */
  let _lavaCoreLights = [];
  let _bubbleAccum = 0;
  let _fireballAccum = 0;
  let _edgeFlameAccum = 0;
  let _lavaGlowAccum = 0;

  function tick(dtSec, worldView, viewport, weather) {
    const tx0 = Math.floor(Number(viewport?.vx0) || 0);
    const ty0 = Math.floor(Number(viewport?.vy0) || 0);
    const tx1 = Math.ceil(Number(viewport?.vx1) || 0);
    const ty1 = Math.ceil(Number(viewport?.vy1) || 0);
    const regionKey = `${Number(worldView?.turn || 0) | 0}:${Number(worldView?.currentDepth || 0) | 0}:${tx0},${ty0},${tx1},${ty1}`;
    if (regionKey !== _regionCacheKey) {
      _regionCacheKey = regionKey;
      _regions = extractSurfaceRegions(worldView, viewport, classifySurfaceTile);
    }

    /** @type {Set<string>} */
    const waterKeys = new Set();
    /** @type {Map<string, { key:string, x:number, y:number, family:string, tone:string }>} */
    const waterCellByKey = new Map();
    /** @type {Array<{ key:string, x:number, y:number, family:string, tone:string }>} */
    const waterCells = [];
    for (let i = 0; i < _regions.length; i++) {
      const region = _regions[i];
      if (region.family !== "water") continue;
      for (let j = 0; j < region.cells.length; j++) {
        const cell = region.cells[j];
        waterKeys.add(cell.key);
        waterCellByKey.set(cell.key, cell);
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

    const seenFisheryIds = new Set();
    const entities = Array.isArray(worldView?.entities) ? worldView.entities : [];
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (String(entity?.kind || "") !== "fishing_spot") continue;
      const tags = Array.isArray(entity.tags) ? entity.tags : [];
      const id = Number(entity.id || 0) | 0;
      const x = Number(entity?.pos?.x || 0) | 0;
      const y = Number(entity?.pos?.y || 0) | 0;
      const key = cellKey(x, y);
      seenFisheryIds.add(id);
      const cell = waterCellByKey.get(key);
      if (!cell || tags.includes("fishing_spot_depleted") || tags.includes("fishing_pressure_overfished")) {
        _fisheryRippleAccum.delete(id);
        continue;
      }
      const pressureMedium = tags.includes("fishing_pressure_medium");
      const rate = pressureMedium ? 1.8 : 4.5;
      let acc = (_fisheryRippleAccum.has(id) ? Number(_fisheryRippleAccum.get(id) || 0) : 1)
        + Math.max(0, Number(dtSec) || 0) * rate;
      while (acc >= 1) {
        acc -= 1;
        spawnWaterImpactRipple(_waterRipples, cell, {
          alpha: pressureMedium ? 0.36 : 0.62,
          rings: 3,
        });
        if (_waterRipples.length > 128) _waterRipples.splice(0, _waterRipples.length - 128);
      }
      _fisheryRippleAccum.set(id, acc);
    }
    for (const id of _fisheryRippleAccum.keys()) {
      if (!seenFisheryIds.has(id)) _fisheryRippleAccum.delete(id);
    }

    // ---- Lava bubbles + fireballs ----
    /** @type {Array<{ key:string, x:number, y:number }>} */
    const lavaCells = [];
    for (let i = 0; i < _regions.length; i++) {
      const region = _regions[i];
      if (region.family !== "lava") continue;
      for (let j = 0; j < region.cells.length; j++) lavaCells.push(region.cells[j]);
    }

    // Advance existing lava bubbles
    const nextBubbles = [];
    for (let i = 0; i < _lavaBubbles.length; i++) {
      const b = _lavaBubbles[i];
      b.ttl -= dtSec;
      if (b.ttl > 0) { b.r += dtSec * 0.12; nextBubbles.push(b); }
    }
    _lavaBubbles = nextBubbles;

    // Advance existing fireballs
    const nextFireballs = [];
    for (let i = 0; i < _lavaFireballs.length; i++) {
      const f = _lavaFireballs[i];
      f.ttl -= dtSec;
      if (f.ttl > 0) { f.x += f.vx * dtSec; f.y += f.vy * dtSec; f.vy -= dtSec * 0.8; nextFireballs.push(f); }
    }
    _lavaFireballs = nextFireballs;

    // Advance short-lived ember light proxies (for pool particles).
    const nextEmberLights = [];
    for (let i = 0; i < _lavaEmberLights.length; i++) {
      const e = _lavaEmberLights[i];
      e.ttl -= dtSec;
      if (e.ttl <= 0) continue;
      e.x += e.vx * dtSec;
      e.y += e.vy * dtSec;
      e.vy += e.ay * dtSec;
      nextEmberLights.push(e);
    }
    _lavaEmberLights = nextEmberLights;

    // Advance ambient lava-glow light proxies (driven by ambient glow particles).
    const nextGlowLights = [];
    for (let i = 0; i < _lavaGlowLights.length; i++) {
      const g = _lavaGlowLights[i];
      g.ttl -= dtSec;
      if (g.ttl <= 0) continue;
      g.x += g.vx * dtSec;
      g.y += g.vy * dtSec;
      g.vy += g.ay * dtSec;
      nextGlowLights.push(g);
    }
    _lavaGlowLights = nextGlowLights;

    // Stable interior glow anchors so lava tiles always read emissive.
    const nextCoreLights = [];
    if (lavaCells.length > 0) {
      const fxTime = Number(getFxTime?.() || 0);
      for (let i = 0; i < _regions.length; i++) {
        const region = _regions[i];
        if (region.family !== "lava" || !Array.isArray(region.cells) || region.cells.length === 0) continue;
        const cells = region.cells;
        let cx = 0;
        let cy = 0;
        for (let j = 0; j < cells.length; j++) {
          cx += cells[j].x + 0.5;
          cy += cells[j].y + 0.5;
        }
        cx /= cells.length;
        cy /= cells.length;
        const stride = cells.length <= 8 ? 1 : (cells.length <= 24 ? 2 : 3);
        const maxLights = Math.max(1, Math.min(24, Math.ceil(cells.length / stride)));
        const phaseShift = (Math.floor(fxTime * 2) + (region.seed & 3)) % stride;
        let regionAdded = 0;
        for (let j = phaseShift; j < cells.length; j += stride) {
          if (nextCoreLights.length >= 64 || regionAdded >= maxLights) break;
          const cell = cells[j];
          const baseX = cell.x + 0.5;
          const baseY = cell.y + 0.5;
          const toCx = cx - baseX;
          const toCy = cy - baseY;
          const len = Math.sqrt(toCx * toCx + toCy * toCy) || 1;
          const inward = 0.10 / len;
          const h = hash32(cell.x | 0, cell.y | 0, region.seed | 0, j | 0);
          const jitterX = (((h & 255) / 255) - 0.5) * 0.08;
          const jitterY = ((((h >>> 8) & 255) / 255) - 0.5) * 0.08;
          nextCoreLights.push({
            x: baseX + toCx * inward + jitterX,
            y: baseY + toCy * inward + jitterY,
            radius: 1.02 + (((h >>> 16) & 255) / 255) * 0.36,
            phase: ((h >>> 24) & 255) * 0.09,
            pulse: 0.09 + (((h >>> 12) & 255) / 255) * 0.12,
          });
          regionAdded++;
        }
      }
    }
    _lavaCoreLights = nextCoreLights;

    if (lavaCells.length > 0) {
      // Spawn bubbles: ~2 per second per lava cell, capped
      _bubbleAccum += dtSec * Math.min(12, lavaCells.length * 2);
      while (_bubbleAccum >= 1 && _lavaBubbles.length < 24) {
        _bubbleAccum -= 1;
        const cell = lavaCells[(Math.random() * lavaCells.length) | 0];
        _lavaBubbles.push({
          x: cell.x - 0.3 + Math.random() * 0.6,
          y: cell.y - 0.3 + Math.random() * 0.6,
          r: 0.02 + Math.random() * 0.03,
          ttl: 0.4 + Math.random() * 0.5,
          max: 0.4 + Math.random() * 0.5,
          cellKey: cell.key,
        });
      }

      // Spawn fireballs: ~0.3 per second total, rare
      _fireballAccum += dtSec * 0.3;
      while (_fireballAccum >= 1 && _lavaFireballs.length < 3) {
        _fireballAccum -= 1;
        const cell = lavaCells[(Math.random() * lavaCells.length) | 0];
        _lavaFireballs.push({
          x: cell.x - 0.2 + Math.random() * 0.4,
          y: cell.y - 0.2 + Math.random() * 0.4,
          vx: (Math.random() - 0.5) * 0.6,
          vy: -0.5 - Math.random() * 0.4,
          ttl: 0.5 + Math.random() * 0.3,
          max: 0.5 + Math.random() * 0.3,
          size: 0.04 + Math.random() * 0.04,
        });
      }

      // Ambient lava glow emitters: compact jets with high gravity + medium TTL.
      if (fx?.pool) {
        _lavaGlowAccum += dtSec * Math.min(148, lavaCells.length * 5.2);
        while (_lavaGlowAccum >= 1 && _lavaGlowLights.length < 180) {
          _lavaGlowAccum -= 1;
          const cell = lavaCells[(Math.random() * lavaCells.length) | 0];
          const x = cell.x + 0.18 + Math.random() * 0.64;
          const y = cell.y + 0.22 + Math.random() * 0.56;
          const vx = (Math.random() - 0.5) * 0.14;
          const vy = -0.76 + Math.random() * 0.42;
          const ay = 1.62;
          const life = 0.62 + Math.random() * 0.56;
          fx.pool.spawn(new Particle({
            x,
            y,
            vx,
            vy,
            ay,
            life,
            size0: 0.10 + Math.random() * 0.06,
            size1: 0.028,
            r: 255,
            g: 118 + (Math.random() * 42 | 0),
            b: 22 + (Math.random() * 16 | 0),
            a0: 0.24 + Math.random() * 0.12,
            a1: 0.0,
          }));
          _lavaGlowLights.push({
            x,
            y,
            vx,
            vy,
            ay,
            ttl: life,
            max: life,
            radius: 0.92 + Math.random() * 0.40,
          });
        }
      }
    } else {
      _lavaGlowAccum = 0;
    }

    // ---- Occasional edge flames via particle pool (like familiar_fireball) ----
    if (fx?.pool && lavaCells.length > 0) {
      for (let i = 0; i < _regions.length; i++) {
        const region = _regions[i];
        if (region.family !== "lava" || !region.loops.length) continue;
        _edgeFlameAccum += dtSec * 0.4;
        while (_edgeFlameAccum >= 1) {
          _edgeFlameAccum -= 1;
          const loop = region.loops[(Math.random() * region.loops.length) | 0];
          if (!loop || loop.length < 4) continue;
          const pt = sampleBezierHullPoint(loop);
          // Torch-like burst: 3-5 particles per spawn, arcing up then falling
          const count = 3 + ((Math.random() * 3) | 0);
          for (let k = 0; k < count; k++) {
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.95;
            const spd = 0.5 + Math.random() * 0.8;
            fx.pool.spawn(new Particle({
              x: pt.x + (Math.random() - 0.5) * 0.1,
              y: pt.y + (Math.random() - 0.5) * 0.1,
              vx: Math.cos(angle) * spd * 0.4,
              vy: Math.sin(angle) * spd,
              ay: 0.8,  // gravity arc
              life: 0.25 + Math.random() * 0.35,
              size0: 0.10 + Math.random() * 0.08,
              size1: 0.02,
              r: 255,
              g: 100 + (Math.random() * 100 | 0),
              b: 10 + (Math.random() * 30 | 0),
              a0: 0.85,
            }));

            // Subtle dynamic light proxy for a subset of flame particles.
            if (_lavaEmberLights.length < 24 && Math.random() < 0.55) {
              _lavaEmberLights.push({
                x: pt.x + (Math.random() - 0.5) * 0.1,
                y: pt.y + (Math.random() - 0.5) * 0.1,
                vx: Math.cos(angle) * spd * 0.25,
                vy: Math.sin(angle) * spd * 0.55,
                ay: 0.8,
                ttl: 0.18 + Math.random() * 0.20,
                max: 0.18 + Math.random() * 0.20,
                radius: 0.48 + Math.random() * 0.26,
              });
            }
          }
        }
      }
    } else if (lavaCells.length === 0) {
      _edgeFlameAccum = 0;
    }

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
      spawnWaterImpactRipple(_waterRipples, cell, {
        alpha: weather === "heavy_rain" ? 0.28 : 0.20,
      });
      if (_waterRipples.length > rippleBudget) {
        _waterRipples.splice(0, _waterRipples.length - rippleBudget);
      }
    }
  }

  // Area fill rendering moved to SDF light field. Ripples + lava particles on top.
  function draw(ctx) {
    if (!_regions.length) return;

    // Water ripples (clipped to hull)
    if (_waterRipples.length > 0) {
      ctx.save();
      for (let i = 0; i < _regions.length; i++) {
        const region = _regions[i];
        if (region.family !== "water" || !region.loops.length) continue;
        ctx.save();
        traceSurfaceHullPath(ctx, region.loops);
        ctx.clip();
        ctx.globalCompositeOperation = "source-over";
        for (let j = 0; j < _waterRipples.length; j++) {
          const ripple = _waterRipples[j];
          if (!region.cellKeys.has(ripple.cellKey)) continue;
          drawWaterRipple(ctx, ripple);
        }
        ctx.restore();
      }
      ctx.restore();
    }

    // Lava bubbles — expanding circles that pop
    if (_lavaBubbles.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < _lavaBubbles.length; i++) {
        const b = _lavaBubbles[i];
        const life = b.max > 0 ? 1 - (b.ttl / b.max) : 1;
        const alpha = (1 - life) * 0.35;
        if (alpha <= 0.005) continue;
        ctx.strokeStyle = `rgba(255,200,100,${alpha.toFixed(3)})`;
        ctx.lineWidth = 0.03;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.stroke();
        // Pop flash at end of life
        if (life > 0.8) {
          const popA = ((life - 0.8) / 0.2) * 0.25;
          ctx.fillStyle = `rgba(255,240,180,${popA.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // Lava fireballs — bright sparks that arc upward
    if (_lavaFireballs.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < _lavaFireballs.length; i++) {
        const f = _lavaFireballs[i];
        const life = f.max > 0 ? 1 - (f.ttl / f.max) : 1;
        const alpha = Math.max(0, (1 - life * life) * 0.6);
        if (alpha <= 0.005) continue;
        // Bright core
        ctx.fillStyle = `rgba(255,220,120,${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
        ctx.fill();
        // Outer glow
        ctx.fillStyle = `rgba(255,140,40,${(alpha * 0.5).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

  }

  /** Return regions for the SDF surface renderer. */
  function getSurfaceRegions() {
    return _regions;
  }

  /** Surface-local transient lights (tiny): lava fireballs + ember flame particles. */
  function getActiveLights() {
    const out = [];
    const fxTime = Number(getFxTime?.() || 0);
    for (let i = 0; i < _lavaCoreLights.length; i++) {
      const c = _lavaCoreLights[i];
      const f = 0.80 + c.pulse * Math.sin(fxTime * 3.7 + c.phase);
      out.push({
        x: c.x,
        y: c.y,
        radius: c.radius * (0.88 + 0.05 * Math.sin(fxTime * 6.4 + c.phase * 1.7)),
        color: [255, 132, 46],
        flicker: f,
      });
    }
    for (let i = 0; i < _lavaGlowLights.length; i++) {
      const g = _lavaGlowLights[i];
      const life = g.max > 0 ? Math.max(0, Math.min(1, g.ttl / g.max)) : 0;
      if (life <= 0) continue;
      out.push({
        x: g.x,
        y: g.y,
        radius: g.radius * (0.60 + life * 0.30),
        color: [255, 136, 46],
        flicker: 0.76 + life * 0.22,
      });
    }
    for (let i = 0; i < _lavaFireballs.length; i++) {
      const f = _lavaFireballs[i];
      const life = f.max > 0 ? Math.max(0, Math.min(1, f.ttl / f.max)) : 0;
      if (life <= 0) continue;
      out.push({
        x: f.x,
        y: f.y,
        radius: (0.72 + f.size * 5.5) * (0.68 + life * 0.32),
        color: [255, 122, 42],
        flicker: 0.88 + life * 0.34,
      });
    }
    for (let i = 0; i < _lavaEmberLights.length; i++) {
      const e = _lavaEmberLights[i];
      const life = e.max > 0 ? Math.max(0, Math.min(1, e.ttl / e.max)) : 0;
      if (life <= 0) continue;
      out.push({
        x: e.x,
        y: e.y,
        radius: e.radius * (0.62 + life * 0.38),
        color: [255, 108, 34],
        flicker: 0.76 + life * 0.28,
      });
    }
    return out;
  }

  return { tick, draw, getSurfaceRegions, getActiveLights };
}
