const TAU = Math.PI * 2;

export function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}

export function closestPointOnSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  if (ab2 === 0) {
    return { x: ax, y: ay, t: 0 };
  }
  let t = (apx * abx + apy * aby) / ab2;
  t = clamp(t, 0, 1);
  return { x: ax + abx * t, y: ay + aby * t, t };
}

export function sdfCircle(px, py, cx, cy, r) {
  return r - Math.hypot(px - cx, py - cy);
}

export function sdfCapsule(px, py, ax, ay, bx, by, r) {
  const c = closestPointOnSegment(px, py, ax, ay, bx, by);
  const d = Math.hypot(px - c.x, py - c.y);
  return r - d;
}

export function sdfOrientedBox(px, py, cx, cy, hx, hy, rot) {
  const s = Math.sin(rot);
  const c = Math.cos(rot);
  const dx = px - cx;
  const dy = py - cy;
  const lx = Math.abs(c * dx + s * dy) - hx;
  const ly = Math.abs(-s * dx + c * dy) - hy;
  const ax = Math.max(lx, 0);
  const ay = Math.max(ly, 0);
  const outside = Math.hypot(ax, ay);
  const inside = Math.max(lx, ly);
  return -(outside) - inside;
}

export function bboxCircle(cx, cy, r) {
  return {
    minX: cx - r,
    minY: cy - r,
    maxX: cx + r,
    maxY: cy + r,
  };
}

export function bboxCapsule(ax, ay, bx, by, r) {
  const minX = Math.min(ax, bx) - r;
  const maxX = Math.max(ax, bx) + r;
  const minY = Math.min(ay, by) - r;
  const maxY = Math.max(ay, by) + r;
  return { minX, minY, maxX, maxY };
}

export function bboxOrientedBox(ax, ay, bx, by, halfW, rot) {
  const cx = (ax + bx) / 2;
  const cy = (ay + by) / 2;
  const len = Math.hypot(bx - ax, by - ay);
  const hx = len / 2;
  const hy = halfW;
  const corners = [
    [-hx, -hy],
    [hx, -hy],
    [hx, hy],
    [-hx, hy],
  ].map(([x, y]) => {
    const rx = Math.cos(rot) * x - Math.sin(rot) * y;
    const ry = Math.sin(rot) * x + Math.cos(rot) * y;
    return [rx + cx, ry + cy];
  });
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of corners) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

export function expandBounds(bounds, pad) {
  return {
    minX: bounds.minX - pad,
    minY: bounds.minY - pad,
    maxX: bounds.maxX + pad,
    maxY: bounds.maxY + pad,
  };
}

export const EPSILON = 1e-6;
export const RAY_EPS_HIT = 0.25;
export const RAY_EPS_STEP = 0.5;

export function normalize(vx, vy) {
  const len = Math.hypot(vx, vy);
  if (len === 0) return { x: 1, y: 0, len: 0 };
  return { x: vx / len, y: vy / len, len };
}

export function mix(a, b, t) {
  return a + (b - a) * t;
}

export function midpoint(ax, ay, bx, by) {
  return { x: (ax + bx) * 0.5, y: (ay + by) * 0.5 };
}

export function lerpPoint(ax, ay, bx, by, t) {
  return { x: mix(ax, bx, t), y: mix(ay, by, t) };
}

export function projectPoint(ax, ay, dirx, diry, t) {
  return { x: ax + dirx * t, y: ay + diry * t };
}

export function length(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

export function area(bounds) {
  return (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);
}

export function boundsUnion(a, b) {
  if (!a) return { ...b };
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

export function boundsPad(bounds, pad) {
  return {
    minX: bounds.minX - pad,
    minY: bounds.minY - pad,
    maxX: bounds.maxX + pad,
    maxY: bounds.maxY + pad,
  };
}

export function boundsCopy(b) {
  return b ? { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY } : null;
}

export function boundsContains(bounds, x, y) {
  if (!bounds) return false;
  return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
}

export function circleArea(r) {
  return Math.PI * r * r;
}

export { TAU };
