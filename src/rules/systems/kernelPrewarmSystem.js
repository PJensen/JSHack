import { getKernel, getPortalsV, attachKernelCache } from "../analytic/analyticDungeon.js";
import { KernelCache } from "../analytic/kernelCache.js";

const DEFAULT_RADIUS = 1.5;

function distancePointToSegment(p, a, b) {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const ap = { x: p.x - a.x, y: p.y - a.y };
  const abLenSq = ab.x * ab.x + ab.y * ab.y;
  let t = 0;
  if (abLenSq > 0) {
    t = Math.max(0, Math.min(1, (ap.x * ab.x + ap.y * ab.y) / abLenSq));
  }
  const closest = { x: a.x + ab.x * t, y: a.y + ab.y * t };
  return Math.hypot(p.x - closest.x, p.y - closest.y);
}

function distanceToPortalFootprint(portal, pos) {
  if (!portal?.shape2D) return Infinity;
  const shape = portal.shape2D;
  if (shape.type === "circle") {
    const center = shape.center ?? { x: 0, y: 0 };
    const radius = shape.radius ?? 0;
    return Math.max(0, Math.hypot(pos.x - center.x, pos.y - center.y) - radius);
  }
  if (shape.type === "box") {
    const dx = Math.max(shape.min.x - pos.x, 0, pos.x - shape.max.x);
    const dy = Math.max(shape.min.y - pos.y, 0, pos.y - shape.max.y);
    return Math.hypot(dx, dy);
  }
  if (shape.type === "polygon" && Array.isArray(shape.points)) {
    let min = Infinity;
    for (let i = 0; i < shape.points.length; i++) {
      const a = shape.points[i];
      const b = shape.points[(i + 1) % shape.points.length];
      min = Math.min(min, distancePointToSegment(pos, a, b));
    }
    return min;
  }
  return Infinity;
}

export function createKernelPrewarmSystem({
  floorRefComponent,
  positionComponent,
  cache = new KernelCache(4),
  radius = DEFAULT_RADIUS,
  portalsAccessor = getPortalsV,
} = {}) {
  if (!floorRefComponent || !positionComponent) {
    throw new Error("KernelPrewarmSystem requires floorRefComponent and positionComponent");
  }
  attachKernelCache(cache);

  return function kernelPrewarmSystem(world) {
    for (const [, floorRef, position] of world.query(floorRefComponent, positionComponent)) {
      if (!position) continue;
      cache.markHot(floorRef.floorId);
      const portals = portalsAccessor(floorRef.floorId) ?? [];
      for (const portal of portals) {
        const dist = distanceToPortalFootprint(portal, position);
        if (dist <= radius) {
          cache.markHot(portal.toFloor);
          getKernel(portal.toFloor);
        }
      }
    }
  };
}

export const __doc__ = {
  purpose: "Pre-warms analytic kernels near portals to avoid traversal stalls",
  stability: "beta",
  author: "CODEX",
  version: "2025.11.11",
  notes: [
    "Marks current and neighbouring floors as hot within the kernel cache.",
    "Touches getKernel to ensure rebuild occurs before traversal events.",
    "Radius parameter provides deterministic proximity-triggered prewarm behaviour.",
  ],
};
