// display/lighting/renderEmissiveLights.js
// Render emissive light overlays with analytic occluders from the geometry kernel.

const TAU = Math.PI * 2;

/**
 * @typedef {{ id:string|number, x:number, y:number, radius:number, intensity:number, color:string, flicker:number, style:string|null, emitter:string|null }} DisplayLight
 */

/**
 * Render emissive lighting as a darkness overlay carved by smooth polygons per light source.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../../rules/environment/GeometryKernel.js').GeometryKernel|null} kernel
 * @param {DisplayLight[]} lights
 * @param {{ x0:number, y0:number, x1:number, y1:number }} bounds
 * @param {number} time
 * @param {{ quality?: string, ambientAlpha?: number, fov?: { origin:{x:number,y:number}, points:Array<{x:number,y:number}>, maxDistance:number, color?:string } }} opts
 */
export function renderEmissiveLights(ctx, kernel, lights, bounds, time = 0, opts = {}) {
  if (!ctx) return;
  const quality = (opts.quality || 'auto').toLowerCase();
  const ambientAlpha = opts.ambientAlpha ?? (quality === 'low' ? 0.68 : quality === 'high' ? 0.8 : 0.75);
  const sampleCount = quality === 'high' ? 128 : quality === 'low' ? 56 : 96;
  const margin = 3;
  const irregularity = Math.max(0, Math.min(0.8, opts.irregularity ?? 0.2));
  const warmth = Math.max(0, Math.min(1, opts.warmth ?? 0.3));

  const rectX = bounds.x0 - margin;
  const rectY = bounds.y0 - margin;
  const rectW = (bounds.x1 - bounds.x0) + margin * 2;
  const rectH = (bounds.y1 - bounds.y0) + margin * 2;

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(0,0,0,${ambientAlpha})`;
  ctx.fillRect(rectX, rectY, rectW, rectH);

  const computed = [];
  if (Array.isArray(lights)) {
    for (let i = 0; i < lights.length; i++) {
      const light = lights[i];
      if (!(Number.isFinite(light.radius) && light.radius > 0)) continue;
      const flick = applyFlicker(light, time);
      const radius = Math.max(0.1, flick.radius);
      const polygon = sampleLightPolygon(kernel, light.x, light.y, radius, sampleCount);
      if (!polygon || polygon.points.length < 3) continue;
      const color = parseColor(light.color);
      computed.push({
        light,
        radius,
        intensity: Math.max(0, flick.intensity),
        color,
        maxDistance: polygon.maxDistance,
        points: polygon.points,
      });
    }
  }

  if (computed.length > 0) {
    // First remove darkness under the light volumes for smooth falloff
    for (let i = 0; i < computed.length; i++) {
      const entry = computed[i];
      const { light, radius, intensity, points } = entry;
      const maxDist = Math.max(radius * 0.8, entry.maxDistance + 0.45);
      ctx.save();
      buildPath(ctx, points);
      ctx.clip();
      ctx.globalCompositeOperation = 'destination-out';
      const grad = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, maxDist);
      const cutAlpha = Math.min(0.95, 0.55 + intensity * 0.35);
      grad.addColorStop(0, `rgba(0,0,0,${cutAlpha})`);
      grad.addColorStop(0.7, `rgba(0,0,0,${cutAlpha * 0.35})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(light.x - maxDist, light.y - maxDist, maxDist * 2, maxDist * 2);
      ctx.restore();
    }

    // Then add a tinted additive glow constrained to the polygon
    for (let i = 0; i < computed.length; i++) {
      const entry = computed[i];
      const { light, radius, intensity, points, color } = entry;
      const maxDist = Math.max(radius * 0.9, entry.maxDistance + 0.5);
      ctx.save();
      // Build an irregular, inward-jittered polygon to create a more organic halo
      const seed = hashToUnit(light.id ?? `${light.x},${light.y}`);
      const jittered = jitterPolygon(points, light.x, light.y, irregularity, seed, time);
      buildPath(ctx, jittered);
      ctx.clip();
      ctx.globalCompositeOperation = 'lighter';

      // Subtle per-light alpha flicker (on top of intensity flicker)
      const wobble = Math.sin(time * 5.2 + seed * 9.1) * 0.5 + Math.sin(time * 3.3 + seed * 13.7) * 0.5;
      const flickerAlpha = 1 + wobble * 0.12;
      const warmCol = warmColor(color, warmth);

      // Layer 1: wide, soft halo (higher alpha, long falloff)
      let grad = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, maxDist);
      grad.addColorStop(0.0, rgba(warmCol, Math.min(1, 0.28 * intensity * flickerAlpha)));
      grad.addColorStop(0.6, rgba(warmCol, Math.min(1, 0.12 * intensity * flickerAlpha)));
      grad.addColorStop(1.0, rgba(color, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(light.x - maxDist, light.y - maxDist, maxDist * 2, maxDist * 2);

      // Layer 2: tighter inner bloom without a hot core (higher alpha)
      const innerR = maxDist * 0.55;
      grad = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, innerR);
      grad.addColorStop(0.0, rgba(warmCol, Math.min(1, 0.55 * intensity * flickerAlpha)));
      grad.addColorStop(0.7, rgba(color, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(light.x - innerR, light.y - innerR, innerR * 2, innerR * 2);
      ctx.restore();
    }

  }

  const fov = opts.fov;
  const fovPoints = Array.isArray(fov?.points) ? fov.points : null;
  if (fov?.origin && fovPoints && fovPoints.length >= 2) {
    const path = [fov.origin, ...fovPoints];
    const maxDist = Math.max(0.25, Number(fov.maxDistance) || 0);
    const color = parseColor(fov.color || '#6cf');
    const extent = maxDist + 0.75;

    ctx.save();
    buildPath(ctx, path);
    ctx.clip();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(fov.origin.x - extent, fov.origin.y - extent, extent * 2, extent * 2);
    ctx.restore();

    ctx.save();
    buildPath(ctx, path);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(color, 0.12);
    ctx.fillRect(fov.origin.x - extent, fov.origin.y - extent, extent * 2, extent * 2);
    ctx.restore();

    ctx.save();
    buildPath(ctx, path);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(color, 0.18);
    ctx.lineWidth = 0.18;
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function applyFlicker(light, time) {
  const baseRadius = Math.max(0, Number(light.radius) || 0);
  const baseIntensity = Math.max(0, Number(light.intensity) || 0.75);
  const flicker = Math.max(0, Number(light.flicker) || 0);
  if (!(flicker > 0)) {
    return { radius: baseRadius, intensity: baseIntensity };
  }
  const seed = hashToUnit(light.id ?? `${light.x},${light.y}`) * TAU;
  const wobble = Math.sin(time * 3.1 + seed) * 0.6 + Math.sin(time * 5.3 + seed * 1.7) * 0.4;
  const factor = 1 + wobble * (0.18 * Math.min(1, flicker));
  const intensityFactor = 1 + wobble * (0.28 * Math.min(1.2, flicker + 0.2));
  return {
    radius: baseRadius * Math.max(0.6, factor),
    intensity: baseIntensity * Math.max(0.5, intensityFactor),
  };
}

function sampleLightPolygon(kernel, ox, oy, radius, samples) {
  const pts = [];
  if (!(radius > 0) || !Number.isFinite(radius)) return null;
  const sampleCount = Math.max(8, samples | 0);
  const step = TAU / sampleCount;
  let maxDistance = 0;
  if (!kernel) {
    for (let i = 0; i < sampleCount; i++) {
      const a = step * i;
      pts.push({ x: ox + Math.cos(a) * radius, y: oy + Math.sin(a) * radius });
    }
    maxDistance = radius;
    return { points: pts, maxDistance };
  }

  let prevDist = radius;
  for (let i = 0; i < sampleCount; i++) {
    const ang = step * i;
    const dirx = Math.cos(ang);
    const diry = Math.sin(ang);
    const ray = kernel.raycastOccl({ x: ox, y: oy }, { x: dirx, y: diry }, radius);
    let dist = Math.min(radius, Number.isFinite(ray?.t) ? ray.t : radius);
    const hit = !!(ray && ray.hit);
    if (hit) dist = Math.max(0, dist - 0.12);

    if (i > 0 && Math.abs(dist - prevDist) > 0.45) {
      const midAng = ang - step * 0.5;
      const midRay = kernel.raycastOccl({ x: ox, y: oy }, { x: Math.cos(midAng), y: Math.sin(midAng) }, radius);
      let midDist = Math.min(radius, Number.isFinite(midRay?.t) ? midRay.t : radius);
      if (midRay?.hit) midDist = Math.max(0, midDist - 0.12);
      pts.push({ x: ox + Math.cos(midAng) * midDist, y: oy + Math.sin(midAng) * midDist });
      if (midDist > maxDistance) maxDistance = midDist;
    }

    const px = ox + dirx * dist;
    const py = oy + diry * dist;
    pts.push({ x: px, y: py });
    if (dist > maxDistance) maxDistance = dist;

    prevDist = dist;
  }

  return { points: pts, maxDistance };
}

function buildPath(ctx, points) {
  ctx.beginPath();
  if (points.length === 0) return;
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
}

function hashToUnit(key) {
  const s = String(key);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function parseColor(hex) {
  if (typeof hex !== 'string') return { r: 255, g: 200, b: 160 };
  let h = hex.trim();
  if (h.startsWith('#')) h = h.slice(1);
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return { r, g, b };
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return { r, g, b };
  }
  return { r: 255, g: 200, b: 160 };
}

function rgba(color, alpha) {
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${color.r|0},${color.g|0},${color.b|0},${a})`;
}

// Produce a warm-tinted color by blending toward a warm target
function warmColor(color, amount = 0.3) {
  const t = Math.max(0, Math.min(1, amount));
  const warm = { r: 255, g: 180, b: 120 };
  return {
    r: (color.r || 0) * (1 - t) + warm.r * t,
    g: (color.g || 0) * (1 - t) + warm.g * t,
    b: (color.b || 0) * (1 - t) + warm.b * t,
  };
}

// Build an inward-jittered version of a polygon to create an irregular halo shape
function jitterPolygon(points, cx, cy, irregularity, seed, time) {
  const out = [];
  const rIr = Math.max(0, Math.min(0.8, irregularity || 0));
  const s = (seed || 0) * Math.PI * 2;
  const t = time || 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const dx = p.x - cx;
    const dy = p.y - cy;
    const r = Math.hypot(dx, dy);
    if (r <= 1e-6) { out.push({ x: p.x, y: p.y }); continue; }
    const ang = Math.atan2(dy, dx);
    // Two-band pseudo-noise in [0..1]
    let n = 0.5 + 0.5 * Math.sin(ang * 3.1 + t * 1.3 + s * 1.7);
    n = (n + (0.5 + 0.5 * Math.sin(ang * 5.7 - t * 0.9 + s * 2.3))) * 0.5;
    n = Math.max(0, Math.min(1, n));
    const scale = 1 - rIr * n; // shrink up to irregularity fraction
    const nx = cx + dx * scale;
    const ny = cy + dy * scale;
    out.push({ x: nx, y: ny });
  }
  return out;
}
