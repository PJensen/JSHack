const DEFAULT_TTL = 30;
const DEFAULT_EPSILON = 0.15;

function distancePointToSegment(p, a, b) {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const ap = { x: p.x - a.x, y: p.y - a.y };
  const abLenSq = ab.x * ab.x + ab.y * ab.y;
  const dot = ap.x * ab.x + ap.y * ab.y;
  let t = 0;
  if (abLenSq > 0) {
    t = Math.max(0, Math.min(1, dot / abLenSq));
  }
  const closest = { x: a.x + ab.x * t, y: a.y + ab.y * t };
  return Math.hypot(p.x - closest.x, p.y - closest.y);
}

function distanceToShape(shape, pos) {
  if (!shape) return Infinity;
  if (shape.type === "circle") {
    const center = shape.center ?? { x: 0, y: 0 };
    const radius = shape.radius ?? 0;
    const dx = pos.x - center.x;
    const dy = pos.y - center.y;
    return Math.abs(Math.hypot(dx, dy) - radius);
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
  if (shape.type === "box") {
    const dx = Math.max(shape.min.x - pos.x, 0, pos.x - shape.max.x);
    const dy = Math.max(shape.min.y - pos.y, 0, pos.y - shape.max.y);
    return Math.hypot(dx, dy);
  }
  return Infinity;
}

function nextSequence(store, actorId) {
  const current = store.get(actorId) ?? 0;
  const next = current + 1;
  store.set(actorId, next);
  return next;
}

export function createPortalUseSystem({
  floorRefComponent,
  positionComponent,
  facingComponent = null,
  portalTraceComponent,
  ttlTicks = DEFAULT_TTL,
  portalEpsilon = DEFAULT_EPSILON,
  sequenceTracker = new Map(),
  portalsAccessor,
  eventName = "FloorChanged",
} = {}) {
  if (!floorRefComponent || !positionComponent) {
    throw new Error("PortalUseSystem requires floorRefComponent and positionComponent");
  }
  if (typeof portalsAccessor !== "function") {
    throw new Error("PortalUseSystem requires portalsAccessor option returning portals per floor");
  }
  if (!portalTraceComponent) {
    throw new Error("PortalUseSystem requires portalTraceComponent option");
  }

  const lastUse = new Map();

  return function portalUseSystem(world) {
    const step = world.step ?? 0;
    const iterator = facingComponent
      ? world.query(floorRefComponent, positionComponent, facingComponent)
      : world.query(floorRefComponent, positionComponent);

    for (const entry of iterator) {
      const entity = entry[0];
      const floorRef = entry[1];
      const position = entry[2] ?? entry[1 + (facingComponent ? 1 : 0)];
      const facingState = facingComponent ? entry[3] : null;

      if (!floorRef || !position) {
        continue;
      }

      const trace = world.get(entity, portalTraceComponent);
      if (trace && trace.expiresAtTick <= step) {
        world.remove(entity, portalTraceComponent);
      }

      const portals = portalsAccessor(floorRef.floorId);
      if (!portals || portals.length === 0) {
        continue;
      }

      for (const portal of portals) {
        if (!portal.open || !portal.canTraverse) continue;
        const dist = distanceToShape(portal.shape2D, position);
        const threshold = Math.max(portalEpsilon, portal.reentrySnapEpsilon ?? portalEpsilon);
        if (dist > threshold) continue;

        const lastKey = `${entity}:${portal.id}`;
        if (lastUse.get(lastKey) === step) {
          continue;
        }

        const existingTrace = world.get(entity, portalTraceComponent);
        const returning =
          existingTrace &&
          existingTrace.portalId === portal.id &&
          existingTrace.toFloor === floorRef.floorId &&
          existingTrace.expiresAtTick >= step;

        const fromFloor = floorRef.floorId;
        let toFloor;
        let exitPos;

        if (returning) {
          toFloor = existingTrace.fromFloor;
          exitPos = { ...existingTrace.entryPosA };
          world.remove(entity, portalTraceComponent);
        } else {
          toFloor = portal.toFloor;
          exitPos = portal.forward.apply(position);
          const traceComp = existingTrace ?? world.add(entity, portalTraceComponent, {});
          traceComp.portalId = portal.id;
          traceComp.fromFloor = fromFloor;
          traceComp.toFloor = toFloor;
          traceComp.entryPosA = { x: position.x, y: position.y };
          traceComp.exitPosB = { x: exitPos.x, y: exitPos.y };
          traceComp.expiresAtTick = step + ttlTicks;
        }

        floorRef.floorId = toFloor;
        position.x = exitPos.x;
        position.y = exitPos.y;

        if (facingState && typeof portal.arrivalFacing === "number") {
          facingState.facing = portal.arrivalFacing;
        }

        lastUse.set(lastKey, step);
        const seq = nextSequence(sequenceTracker, entity);
        if (typeof world.emit === "function") {
          world.emit(eventName, {
            actorId: entity,
            fromFloor,
            toFloor,
            portalId: portal.id,
            seq,
          });
        }
        break;
      }
    }
  };
}

export const __doc__ = {
  purpose: "Handles analytic portal traversal including deterministic round-trip",
  stability: "beta",
  author: "CODEX",
  version: "2025.11.11",
  notes: [
    "Detects traversal proximity analytically and mediates floor changes via portals.",
    "Maintains PortalTrace for drift-free round-trip returns within a TTL window.",
    "Emits FloorChanged events with per-actor sequence ids for downstream idempotence.",
  ],
};
