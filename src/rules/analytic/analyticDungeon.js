import { KernelCache } from "./kernelCache.js";

const EPS = 1e-6;

const floorDefinitions = new Map();
const kernelRegistry = new Map();
let activeCache = new KernelCache(4);

const portalRegistryV = new Map();
const portalRegistryH = new Map();

function clone(obj) {
  if (obj == null) return obj;
  if (typeof structuredClone === "function") {
    return structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj));
}

function hashPayload(payload) {
  const data = typeof payload === "string" ? payload : JSON.stringify(payload);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < data.length; i++) {
    hash ^= BigInt(data.charCodeAt(i));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
}

export class Kernel2D {
  constructor(hash, primitives = [], options = {}) {
    this.hash = hash;
    this.primitives = primitives.map((p) => ({ ...p }));
    this.options = { ...options };
    this.version = options.version ?? 0;
  }

  distance(p) {
    let minDist = Infinity;
    let inside = false;
    for (const prim of this.primitives) {
      if (prim.type === "solid-box") {
        const distInfo = distanceBox(p, prim);
        if (distInfo.inside) {
          inside = true;
          minDist = Math.min(minDist, -distInfo.depth);
        } else {
          minDist = Math.min(minDist, distInfo.depth);
        }
      } else if (prim.type === "solid-circle") {
        const dx = p.x - prim.center.x;
        const dy = p.y - prim.center.y;
        const d = Math.hypot(dx, dy) - prim.radius;
        if (d <= 0) {
          inside = true;
          minDist = Math.min(minDist, d);
        } else {
          minDist = Math.min(minDist, d);
        }
      } else if (prim.type === "solid-polygon") {
        const distInfo = distancePolygon(p, prim);
        if (distInfo.inside) {
          inside = true;
          minDist = Math.min(minDist, -distInfo.depth);
        } else {
          minDist = Math.min(minDist, distInfo.depth);
        }
      }
    }
    if (!isFinite(minDist)) {
      return Infinity;
    }
    return inside ? -Math.abs(minDist) : Math.abs(minDist);
  }

  isSolid(p) {
    for (const prim of this.primitives) {
      if (prim.type === "solid-box" && pointInBox(p, prim)) {
        return true;
      }
      if (prim.type === "solid-circle" && pointInCircle(p, prim)) {
        return true;
      }
      if (prim.type === "solid-polygon" && pointInPolygon(p, prim)) {
        return true;
      }
    }
    return false;
  }

  raycast(origin, dir, maxT = Infinity) {
    let hitRecord = null;
    for (const prim of this.primitives) {
      if (prim.type === "solid-box") {
        const hit = raycastBox(origin, dir, prim, maxT);
        if (hit && hit.t >= 0 && hit.t <= maxT) {
          if (!hitRecord || hit.t < hitRecord.t) {
            hitRecord = { ...hit, tag: prim.tag ?? null };
            maxT = hit.t;
          }
        }
      } else if (prim.type === "solid-circle") {
        const hit = raycastCircle(origin, dir, prim, maxT);
        if (hit && hit.t >= 0 && hit.t <= maxT) {
          if (!hitRecord || hit.t < hitRecord.t) {
            hitRecord = { ...hit, tag: prim.tag ?? null };
            maxT = hit.t;
          }
        }
      }
    }
    return hitRecord;
  }

  sweep(aabb, delta) {
    let remaining = { ...delta };
    let earliest = 1;
    for (const prim of this.primitives) {
      const hit = sweepAABB(aabb, prim, delta);
      if (hit && hit.t < earliest) {
        earliest = hit.t;
        remaining = {
          x: delta.x * hit.t,
          y: delta.y * hit.t
        };
      }
    }
    return { resolved: remaining, t: earliest };
  }
}

export function attachKernelCache(cache) {
  activeCache = cache;
}

export function registerFloorDefinition(floorId, definition) {
  floorDefinitions.set(floorId, clone(definition));
}

export function hashKernelArgs(levelArgs, floorArgs, doorHash = "", editsHash = "") {
  return hashPayload({ levelArgs, floorArgs, doorHash, editsHash });
}

export function rebuildKernel(floorId, eventLog = []) {
  const def = floorDefinitions.get(floorId);
  if (!def) {
    throw new Error(`No floor definition registered for ${floorId}`);
  }
  const kernelHash = hashKernelArgs(def.levelArgs ?? null, def.floorArgs ?? null, def.doorHash ?? "", def.editsHash ?? "");
  const kernel = new Kernel2D(kernelHash, def.primitives ?? [], {
    version: def.version ?? 0,
    metadata: { eventLogSize: eventLog.length }
  });
  kernelRegistry.set(floorId, { kernel, hash: kernelHash });
  activeCache.put(floorId, kernel);
  return kernel;
}

export function getKernel(floorId) {
  const cached = activeCache.get(floorId);
  if (cached) {
    return cached;
  }
  const existing = kernelRegistry.get(floorId);
  if (existing) {
    activeCache.put(floorId, existing.kernel);
    return existing.kernel;
  }
  return rebuildKernel(floorId, []);
}

export function getPortalsV(floorId) {
  return (portalRegistryV.get(floorId) ?? []).map((p) => ({ ...p }));
}

export function getPortalsH(floorId) {
  return (portalRegistryH.get(floorId) ?? []).map((p) => ({ ...p }));
}

export function registerPortalV(portal) {
  const normalized = normalizePortalV(portal);
  installPortalEntry(portalRegistryV, normalized.fromFloor, normalized, 1);
  installPortalEntry(portalRegistryV, normalized.toFloor, normalized, -1);
}

export function registerPortalH(portal) {
  const list = portalRegistryH.get(portal.floorId) ?? [];
  list.push(clone(portal));
  portalRegistryH.set(portal.floorId, list);
}

function installPortalEntry(registry, floorId, portal, direction) {
  const list = registry.get(floorId) ?? [];
  const entry = {
    id: portal.id,
    open: portal.open,
    canTraverse: portal.canTraverse,
    canSeeThrough: portal.canSeeThrough,
    visAttn: portal.visAttn,
    reentrySnapEpsilon: portal.reentrySnapEpsilon,
    arrivalFacing: portal.arrivalFacing,
    fromFloor: direction > 0 ? portal.fromFloor : portal.toFloor,
    toFloor: direction > 0 ? portal.toFloor : portal.fromFloor,
    shape2D: clone(portal.shape2D),
    forward: direction > 0 ? portal.transformAB : portal.transformBA,
    inverse: direction > 0 ? portal.transformBA : portal.transformAB
  };
  list.push(entry);
  registry.set(floorId, list);
}

function normalizePortalV(portal) {
  if (!portal || typeof portal !== "object") {
    throw new Error("Portal definition required");
  }
  const { id, fromFloor, toFloor, shape2D, transformAB, transformBA } = portal;
  if (!id) {
    throw new Error("Portal id required");
  }
  if (fromFloor === undefined || toFloor === undefined) {
    throw new Error("Portal floors required");
  }
  if (!shape2D) {
    throw new Error("Portal shape required");
  }
  const forward = ensureTransform(transformAB ?? portal.T_ab);
  const inverse = ensureTransform(transformBA ?? portal.T_ba);
  validateBijection(shape2D, forward, inverse, portal.reentrySnapEpsilon ?? 0.05);
  return {
    id,
    fromFloor,
    toFloor,
    shape2D: clone(shape2D),
    open: portal.open ?? true,
    canTraverse: portal.canTraverse ?? true,
    canSeeThrough: portal.canSeeThrough ?? true,
    visAttn: portal.visAttn ?? 1,
    reentrySnapEpsilon: portal.reentrySnapEpsilon ?? 0.05,
    arrivalFacing: portal.arrivalFacing ?? 0,
    transformAB: forward,
    transformBA: inverse
  };
}

function ensureTransform(transform) {
  if (!transform) {
    throw new Error("Portal transform required");
  }
  if (typeof transform === "function") {
    return { apply: transform };
  }
  if (typeof transform.apply === "function") {
    return transform;
  }
  if (Array.isArray(transform.matrix) && transform.matrix.length === 2) {
    const [[a, b], [c, d]] = transform.matrix;
    const t = transform.translate ?? transform.translation ?? { x: 0, y: 0 };
    return {
      apply(point) {
        return {
          x: a * point.x + b * point.y + t.x,
          y: c * point.x + d * point.y + t.y
        };
      }
    };
  }
  throw new Error("Unsupported transform representation");
}

function validateBijection(shape, forward, inverse, epsilon) {
  const samples = sampleShape(shape);
  for (const p of samples) {
    const mapped = forward.apply(p);
    const roundTrip = inverse.apply(mapped);
    const dx = roundTrip.x - p.x;
    const dy = roundTrip.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > epsilon + EPS) {
      throw new Error(`Portal transform round-trip exceeded epsilon (${dist} > ${epsilon})`);
    }
  }
}

function sampleShape(shape) {
  if (!shape) {
    return [{ x: 0, y: 0 }];
  }
  if (shape.type === "circle") {
    const center = shape.center ?? { x: 0, y: 0 };
    const radius = shape.radius ?? 1;
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const theta = (Math.PI * 2 * i) / 8;
      pts.push({ x: center.x + Math.cos(theta) * radius, y: center.y + Math.sin(theta) * radius });
    }
    return pts;
  }
  if (shape.type === "polygon" && Array.isArray(shape.points)) {
    return shape.points.map((p) => ({ x: p.x, y: p.y }));
  }
  if (shape.type === "box") {
    const { min, max } = shape;
    return [
      { x: min.x, y: min.y },
      { x: max.x, y: min.y },
      { x: max.x, y: max.y },
      { x: min.x, y: max.y }
    ];
  }
  return [{ x: 0, y: 0 }];
}

function pointInBox(p, box) {
  return p.x >= box.min.x - EPS && p.x <= box.max.x + EPS && p.y >= box.min.y - EPS && p.y <= box.max.y + EPS;
}

function pointInCircle(p, circle) {
  const dx = p.x - circle.center.x;
  const dy = p.y - circle.center.y;
  return dx * dx + dy * dy <= (circle.radius + EPS) ** 2;
}

function pointInPolygon(point, poly) {
  const pts = poly.points ?? [];
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y;
    const xj = pts[j].x, yj = pts[j].y;
    const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + EPS) + xi;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

function distanceBox(p, box) {
  const dx = Math.max(box.min.x - p.x, 0, p.x - box.max.x);
  const dy = Math.max(box.min.y - p.y, 0, p.y - box.max.y);
  const outside = Math.hypot(dx, dy);
  const inside = pointInBox(p, box);
  const depth = inside ? Math.min(p.x - box.min.x, box.max.x - p.x, p.y - box.min.y, box.max.y - p.y) : outside;
  return { inside, depth };
}

function distancePolygon(p, poly) {
  const pts = poly.points ?? [];
  if (pts.length < 2) {
    return { inside: false, depth: Infinity };
  }
  let minDist = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    minDist = Math.min(minDist, distancePointToSegment(p, a, b));
  }
  return { inside: pointInPolygon(p, poly), depth: minDist };
}

function distancePointToSegment(p, a, b) {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const ap = { x: p.x - a.x, y: p.y - a.y };
  const abLenSq = ab.x * ab.x + ab.y * ab.y;
  let t = 0;
  if (abLenSq > EPS) {
    t = (ap.x * ab.x + ap.y * ab.y) / abLenSq;
    t = Math.max(0, Math.min(1, t));
  }
  const closest = { x: a.x + ab.x * t, y: a.y + ab.y * t };
  return Math.hypot(p.x - closest.x, p.y - closest.y);
}

function raycastBox(origin, dir, box, maxT) {
  const invDirX = dir.x !== 0 ? 1 / dir.x : Infinity;
  const invDirY = dir.y !== 0 ? 1 / dir.y : Infinity;
  let tmin = ((dir.x >= 0 ? box.min.x : box.max.x) - origin.x) * invDirX;
  let tmax = ((dir.x >= 0 ? box.max.x : box.min.x) - origin.x) * invDirX;
  const tymin = ((dir.y >= 0 ? box.min.y : box.max.y) - origin.y) * invDirY;
  const tymax = ((dir.y >= 0 ? box.max.y : box.min.y) - origin.y) * invDirY;
  if ((tmin > tymax) || (tymin > tmax)) {
    return null;
  }
  if (tymin > tmin) tmin = tymin;
  if (tymax < tmax) tmax = tymax;
  if (tmax < 0 || tmin > maxT) {
    return null;
  }
  const t = Math.max(tmin, 0);
  const point = { x: origin.x + dir.x * t, y: origin.y + dir.y * t };
  const normal = computeBoxNormal(point, box);
  return { hit: true, t, normal };
}

function computeBoxNormal(point, box) {
  const eps = 1e-5;
  if (Math.abs(point.x - box.min.x) < eps) return { x: -1, y: 0 };
  if (Math.abs(point.x - box.max.x) < eps) return { x: 1, y: 0 };
  if (Math.abs(point.y - box.min.y) < eps) return { x: 0, y: -1 };
  if (Math.abs(point.y - box.max.y) < eps) return { x: 0, y: 1 };
  return { x: 0, y: 0 };
}

function raycastCircle(origin, dir, circle, maxT) {
  const ocx = origin.x - circle.center.x;
  const ocy = origin.y - circle.center.y;
  const a = dir.x * dir.x + dir.y * dir.y;
  const b = 2 * (ocx * dir.x + ocy * dir.y);
  const c = ocx * ocx + ocy * ocy - circle.radius * circle.radius;
  const disc = b * b - 4 * a * c;
  if (disc < 0) {
    return null;
  }
  const sqrtDisc = Math.sqrt(disc);
  const t1 = (-b - sqrtDisc) / (2 * a);
  const t2 = (-b + sqrtDisc) / (2 * a);
  let t = Math.min(t1, t2);
  if (t < 0) {
    t = Math.max(t1, t2);
  }
  if (t < 0 || t > maxT) {
    return null;
  }
  const point = { x: origin.x + dir.x * t, y: origin.y + dir.y * t };
  const normal = {
    x: (point.x - circle.center.x) / circle.radius,
    y: (point.y - circle.center.y) / circle.radius
  };
  return { hit: true, t, normal };
}

function sweepAABB(aabb, solid, delta) {
  if (solid.type !== "solid-box") {
    return null;
  }
  const expanded = {
    min: { x: solid.min.x - aabb.halfSize.x, y: solid.min.y - aabb.halfSize.y },
    max: { x: solid.max.x + aabb.halfSize.x, y: solid.max.y + aabb.halfSize.y }
  };
  const hit = raycastBox(aabb.center, delta, {
    min: expanded.min,
    max: expanded.max
  }, 1);
  if (!hit) {
    return null;
  }
  return { t: hit.t };
}

export function resetRegistries() {
  floorDefinitions.clear();
  kernelRegistry.clear();
  portalRegistryV.clear();
  portalRegistryH.clear();
  activeCache = new KernelCache(4);
}

export const __doc__ = {
  purpose: "Analytic multi-floor dungeon kernel",
  stability: "beta",
  author: "CODEX",
  version: "2025.11.11",
  notes: [
    "Analytic geometry canonical for occlusion and lighting.",
    "PortalV governs all vertical traversal.",
    "Round-trip invariant enforced via PortalTrace and inverse transforms."
  ]
};
