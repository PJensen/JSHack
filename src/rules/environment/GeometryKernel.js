import {
  sdfCircle,
  sdfCapsule,
  sdfOrientedBox,
  bboxCircle,
  bboxCapsule,
  bboxOrientedBox,
  boundsUnion,
  boundsPad,
  boundsCopy,
  normalize,
} from "./primitives.js";

const DEFAULTS = {
  maxRaySteps: 192,
  rayEpsHit: 0.25,
  rayEpsStep: 0.5,
  maxSweepSteps: 96,
  sweepMinStep: 0.05,
  // Separate epsilon for movement sweeps so narrow corridors remain navigable
  sweepEpsHit: 0.05,
  gradientStep: 0.01,
};

const EPS = 1e-6;

function withDefaults(opts = {}) {
  return {
    maxRaySteps: opts.maxRaySteps ?? DEFAULTS.maxRaySteps,
    rayEpsHit: opts.rayEpsHit ?? DEFAULTS.rayEpsHit,
    rayEpsStep: opts.rayEpsStep ?? DEFAULTS.rayEpsStep,
    maxSweepSteps: opts.maxSweepSteps ?? DEFAULTS.maxSweepSteps,
    sweepMinStep: opts.sweepMinStep ?? DEFAULTS.sweepMinStep,
    sweepEpsHit: opts.sweepEpsHit ?? DEFAULTS.sweepEpsHit,
    gradientStep: opts.gradientStep ?? DEFAULTS.gradientStep,
  };
}

function primitiveFlags(flags) {
  return {
    affectsMove: flags?.affectsMove !== false,
    affectsOccl: flags?.affectsOccl !== false,
  };
}

function primitiveBounds(prim) {
  switch (prim.type) {
    case "circle":
      return bboxCircle(prim.cx, prim.cy, prim.r);
    case "capsule":
    case "rectslot":
      return bboxCapsule(prim.ax, prim.ay, prim.bx, prim.by, prim.r);
    case "square":
      return bboxOrientedBox(prim.ax, prim.ay, prim.bx, prim.by, prim.halfW, prim.rot);
    case "box":
      return bboxOrientedBox(prim.cx - prim.hx, prim.cy, prim.cx + prim.hx, prim.cy, prim.hy, prim.rot ?? 0);
    default:
      return { minX: prim.cx ?? 0, minY: prim.cy ?? 0, maxX: prim.cx ?? 0, maxY: prim.cy ?? 0 };
  }
}

function primitiveDistance(prim, px, py) {
  switch (prim.type) {
    case "circle":
      return sdfCircle(px, py, prim.cx, prim.cy, prim.r);
    case "capsule":
    case "rectslot":
      return sdfCapsule(px, py, prim.ax, prim.ay, prim.bx, prim.by, prim.r);
    case "square": {
      const cx = (prim.ax + prim.bx) / 2;
      const cy = (prim.ay + prim.by) / 2;
      const len = Math.hypot(prim.bx - prim.ax, prim.by - prim.ay);
      return sdfOrientedBox(px, py, cx, cy, len / 2, prim.halfW, prim.rot);
    }
    case "box":
      return sdfOrientedBox(px, py, prim.cx, prim.cy, prim.hx, prim.hy, prim.rot ?? 0);
    default:
      return -Infinity;
  }
}

function clonePrimitiveData(raw) {
  const { bounds, ...rest } = raw;
  return { ...rest };
}

export class GeometryKernel {
  constructor(opts = {}) {
    this.seed = opts.seed ?? 0;
    this.options = withDefaults(opts);
    this.primitives = [];
    this.nextId = 1;
    this.mbr = null;
    this.mbrVersion = 0;
    this.moveVersion = 0;
    this.occlVersion = 0;
  }

  clear() {
    this.primitives.length = 0;
    this.nextId = 1;
    this.mbr = null;
    this.mbrVersion++;
    this.moveVersion++;
    this.occlVersion++;
  }

  carveCircle(cx, cy, r, flags) {
    const prim = {
      id: this.nextId++,
      type: "circle",
      cx,
      cy,
      r,
      ...primitiveFlags(flags),
    };
    return this.#addPrimitive(prim);
  }

  carveCapsule(ax, ay, bx, by, r, flags) {
    const prim = {
      id: this.nextId++,
      type: "capsule",
      ax,
      ay,
      bx,
      by,
      r,
      ...primitiveFlags(flags),
    };
    return this.#addPrimitive(prim);
  }

  carveRectSlot(ax, ay, bx, by, r, flags) {
    const prim = {
      id: this.nextId++,
      type: "rectslot",
      ax,
      ay,
      bx,
      by,
      r,
      ...primitiveFlags(flags),
    };
    return this.#addPrimitive(prim);
  }

  carveSquare(ax, ay, bx, by, halfW, rot, flags) {
    const prim = {
      id: this.nextId++,
      type: "square",
      ax,
      ay,
      bx,
      by,
      halfW,
      rot,
      ...primitiveFlags(flags),
    };
    return this.#addPrimitive(prim);
  }

  carveBox(cx, cy, halfWidth, halfHeight, rot = 0, flags) {
    const prim = {
      id: this.nextId++,
      type: "box",
      cx,
      cy,
      hx: halfWidth,
      hy: halfHeight,
      rot,
      ...primitiveFlags(flags),
    };
    return this.#addPrimitive(prim);
  }

  carve(bit, path, flags) {
    const type = bit?.type || "circle";
    if (type === "circle") {
      if (path?.kind === "segment") {
        return this.carveCapsule(path.ax, path.ay, path.bx, path.by, bit.radius ?? bit.r ?? 1, flags);
      }
      const cx = bit.cx ?? path?.x ?? path?.cx ?? path?.px ?? 0;
      const cy = bit.cy ?? path?.y ?? path?.cy ?? path?.py ?? 0;
      return this.carveCircle(cx, cy, bit.radius ?? bit.r ?? 1, flags);
    }
    if (type === "capsule") {
      const ax = path?.ax ?? bit.ax ?? 0;
      const ay = path?.ay ?? bit.ay ?? 0;
      const bx = path?.bx ?? bit.bx ?? ax;
      const by = path?.by ?? bit.by ?? ay;
      return this.carveCapsule(ax, ay, bx, by, bit.radius ?? bit.r ?? 1, flags);
    }
    if (type === "rectslot") {
      const ax = path?.ax ?? bit.ax ?? 0;
      const ay = path?.ay ?? bit.ay ?? 0;
      const bx = path?.bx ?? bit.bx ?? ax;
      const by = path?.by ?? bit.by ?? ay;
      return this.carveRectSlot(ax, ay, bx, by, bit.radius ?? bit.r ?? 1, flags);
    }
    if (type === "square") {
      const ax = path?.ax ?? bit.ax ?? 0;
      const ay = path?.ay ?? bit.ay ?? 0;
      const bx = path?.bx ?? bit.bx ?? ax;
      const by = path?.by ?? bit.by ?? ay;
      const halfW = bit.halfWidth ?? bit.halfW ?? 1;
      const rot = bit.rotation ?? bit.rot ?? 0;
      return this.carveSquare(ax, ay, bx, by, halfW, rot, flags);
    }
    if (type === "box") {
      const cx = bit.cx ?? path?.cx ?? path?.x ?? 0;
      const cy = bit.cy ?? path?.cy ?? path?.y ?? 0;
      const halfWidth = bit.halfWidth ?? bit.hx ?? 1;
      const halfHeight = bit.halfHeight ?? bit.hy ?? 1;
      const rot = bit.rotation ?? bit.rot ?? 0;
      return this.carveBox(cx, cy, halfWidth, halfHeight, rot, flags);
    }
    throw new Error(`Unsupported bit type: ${type}`);
  }

  toggle(id, flags = {}) {
    const prim = this.primitives.find((p) => p.id === id);
    if (!prim) return false;
    let moved = false;
    let occl = false;
    if (Object.prototype.hasOwnProperty.call(flags, "affectsMove")) {
      const next = !!flags.affectsMove;
      if (prim.affectsMove !== next) {
        prim.affectsMove = next;
        moved = true;
      }
    }
    if (Object.prototype.hasOwnProperty.call(flags, "affectsOccl")) {
      const next = !!flags.affectsOccl;
      if (prim.affectsOccl !== next) {
        prim.affectsOccl = next;
        occl = true;
      }
    }
    if (moved) this.moveVersion++;
    if (occl) this.occlVersion++;
    return moved || occl;
  }

  distanceMove(x, y) {
    let best = -Infinity;
    for (const prim of this.primitives) {
      if (!prim.affectsMove) continue;
      const d = primitiveDistance(prim, x, y);
      if (d > best) best = d;
    }
    return Math.max(0, best);
  }

  distanceOccl(x, y) {
    let best = -Infinity;
    for (const prim of this.primitives) {
      if (!prim.affectsOccl) continue;
      const d = primitiveDistance(prim, x, y);
      if (d > best) best = d;
    }
    return Math.max(0, best);
  }

  queryGradientMove(x, y, h = this.options.gradientStep) {
    return this.#gradient((px, py) => this.distanceMove(px, py), x, y, h);
  }

  queryGradientOccl(x, y, h = this.options.gradientStep) {
    return this.#gradient((px, py) => this.distanceOccl(px, py), x, y, h);
  }

  raycastOccl(origin, dir, maxT = Infinity) {
    const { x: ux, y: uy, len } = normalize(dir?.x ?? 0, dir?.y ?? 0);
    if (len === 0) {
      return { hit: false, point: { x: origin.x, y: origin.y }, t: 0, steps: 0 };
    }
    const stepLimit = Math.max(1, this.options.maxRaySteps | 0);
    const epsHit = this.options.rayEpsHit;
    const epsStep = this.options.rayEpsStep;
    let t = 0;
    let steps = 0;
    let lastPoint = { x: origin.x, y: origin.y };
    while (t <= maxT && steps < stepLimit) {
      const px = origin.x + ux * t;
      const py = origin.y + uy * t;
      const dist = this.distanceOccl(px, py);
      if (dist <= epsHit) {
        return { hit: true, point: { x: px, y: py }, t, steps };
      }
      const delta = Math.max(dist, epsStep);
      lastPoint = { x: px, y: py };
      t += delta;
      steps++;
    }
    const finalPoint = { x: origin.x + ux * Math.min(t, maxT), y: origin.y + uy * Math.min(t, maxT) };
    return { hit: false, point: finalPoint, t: Math.min(t, maxT), steps };
  }

  sweepCapsule(start, end, radius, opts = {}) {
    const sx = start.x;
    const sy = start.y;
    const ex = end.x;
    const ey = end.y;
    const { x: dirx, y: diry, len: dist } = normalize(ex - sx, ey - sy);
    if (dist === 0) {
      const clear = this.distanceMove(sx, sy) - radius;
      const hit = clear < 0;
      return {
        hit,
        point: { x: sx, y: sy },
        t: 0,
        steps: 0,
        normal: this.queryGradientMove(sx, sy),
      };
    }
    const maxSteps = Math.max(1, opts.maxSteps ?? this.options.maxSweepSteps);
    const minStep = Math.max(EPS, opts.minStep ?? this.options.sweepMinStep);
    const epsHit = opts.epsilon ?? this.options.sweepEpsHit ?? this.options.rayEpsHit;

    let traveled = 0;
    let steps = 0;
    let prevT = 0;
    let prevClear = this.distanceMove(sx, sy) - radius;
    if (prevClear < 0) {
      return {
        hit: true,
        point: { x: sx, y: sy },
        t: 0,
        steps,
        normal: this.queryGradientMove(sx, sy),
      };
    }

    while (steps < maxSteps && traveled < dist + EPS) {
      const px = sx + dirx * traveled;
      const py = sy + diry * traveled;
      const clearance = this.distanceMove(px, py) - radius;
      if (clearance <= epsHit) {
        const contactT = this.#refineContact(sx, sy, dirx, diry, prevT, traveled, radius, epsHit);
        const clampedT = Math.min(contactT, dist);
        const cx = sx + dirx * clampedT;
        const cy = sy + diry * clampedT;
        return {
          hit: true,
          point: { x: cx, y: cy },
          t: clampedT / dist,
          steps: steps + 1,
          normal: this.queryGradientMove(cx, cy),
        };
      }
      prevT = traveled;
      prevClear = clearance;
      const step = Math.max(clearance, minStep);
      traveled += step;
      steps++;
      if (traveled > dist) {
        traveled = dist;
      }
    }
    return {
      hit: false,
      point: { x: ex, y: ey },
      t: 1,
      steps,
      normal: this.queryGradientMove(ex, ey),
    };
  }

  snapshot() {
    return {
      seed: this.seed,
      options: { ...this.options },
      nextId: this.nextId,
      mbr: this.mbr ? boundsCopy(this.mbr) : null,
      mbrVersion: this.mbrVersion,
      moveVersion: this.moveVersion,
      occlVersion: this.occlVersion,
      primitives: this.primitives.map((p) => clonePrimitiveData(p)),
    };
  }

  serialize() {
    return JSON.stringify(this.snapshot());
  }

  deserialize(json) {
    const data = typeof json === "string" ? JSON.parse(json) : json;
    this.seed = data.seed ?? this.seed;
    this.options = withDefaults(data.options || {});
    this.nextId = data.nextId ?? 1;
    this.mbrVersion = data.mbrVersion ?? 0;
    this.moveVersion = data.moveVersion ?? 0;
    this.occlVersion = data.occlVersion ?? 0;
    this.primitives = [];
    this.mbr = null;
    if (Array.isArray(data.primitives)) {
      for (const raw of data.primitives) {
        const prim = { ...raw };
        prim.bounds = primitiveBounds(prim);
        this.primitives.push(prim);
        this.mbr = boundsUnion(this.mbr, prim.bounds);
      }
    }
  }

  getMBR(pad = 0) {
    if (!this.mbr) return null;
    if (!pad) return boundsCopy(this.mbr);
    return boundsPad(this.mbr, pad);
  }

  #addPrimitive(prim) {
    prim.bounds = primitiveBounds(prim);
    this.primitives.push(prim);
    this.mbr = boundsUnion(this.mbr, prim.bounds);
    this.mbrVersion++;
    if (prim.affectsMove) this.moveVersion++;
    if (prim.affectsOccl) this.occlVersion++;
    return prim.id;
  }

  #gradient(fn, x, y, h) {
    const hh = Math.max(EPS, h ?? this.options.gradientStep);
    const dx = fn(x + hh, y) - fn(x - hh, y);
    const dy = fn(x, y + hh) - fn(x, y - hh);
    const inv = 1 / (2 * hh);
    const gx = dx * inv;
    const gy = dy * inv;
    const mag = Math.hypot(gx, gy);
    if (mag === 0) return { x: 0, y: -1 };
    return { x: gx / mag, y: gy / mag };
  }

  #refineContact(sx, sy, dirx, diry, lowT, highT, radius, epsHit) {
    let lo = lowT;
    let hi = highT;
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2;
      const px = sx + dirx * mid;
      const py = sy + diry * mid;
      const clearance = this.distanceMove(px, py) - radius;
      if (clearance > epsHit) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return hi;
  }
}
