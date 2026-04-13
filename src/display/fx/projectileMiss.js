// src/display/fx/projectileMiss.js
// Display-only miss trajectory helper for ranged projectile VFX.

const MISS_MAX_ANGLE_RAD = Math.PI / 12; // +/- 15deg
const MISS_DISTANCE_MIN_SCALE = 1.04;
const MISS_DISTANCE_EXTRA_SCALE = 0.12;

function mix32(n) {
  let x = (Number(n) >>> 0);
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

function u01(seed) {
  return (mix32(seed) & 0xffffffff) / 0x100000000;
}

function pointSeed(from, to, seed = 0) {
  const fx = (Math.round(Number(from?.x || 0) * 64) | 0) >>> 0;
  const fy = (Math.round(Number(from?.y || 0) * 64) | 0) >>> 0;
  const tx = (Math.round(Number(to?.x || 0) * 64) | 0) >>> 0;
  const ty = (Math.round(Number(to?.y || 0) * 64) | 0) >>> 0;
  let out = 0x9e3779b9 ^ (seed >>> 0);
  out = mix32(out ^ fx);
  out = mix32(out ^ ((fy << 7) | (fy >>> 25)));
  out = mix32(out ^ ((tx << 13) | (tx >>> 19)));
  out = mix32(out ^ ((ty << 3) | (ty >>> 29)));
  return out >>> 0;
}

/**
 * Compute a miss endpoint rotated away from the direct shot line by up to +/-15deg.
 * The resulting endpoint is slightly farther than the original target point so the
 * projectile visibly misses instead of clipping the target center.
 *
 * @param {{x:number,y:number}} from
 * @param {{x:number,y:number}} to
 * @param {number} [seed=0]
 */
export function computeMissEndpoint(from, to, seed = 0) {
  const fx = Number(from?.x);
  const fy = Number(from?.y);
  const tx = Number(to?.x);
  const ty = Number(to?.y);
  if (!Number.isFinite(fx) || !Number.isFinite(fy) || !Number.isFinite(tx) || !Number.isFinite(ty)) {
    return to;
  }

  const dx = tx - fx;
  const dy = ty - fy;
  const len = Math.hypot(dx, dy);
  if (!(len > 0.0001)) return to;

  const base = pointSeed(from, to, seed);
  const angle = ((u01(base ^ 0xa511e9b3) * 2) - 1) * MISS_MAX_ANGLE_RAD;
  const distScale = MISS_DISTANCE_MIN_SCALE + (u01(base ^ 0x63d83595) * MISS_DISTANCE_EXTRA_SCALE);

  const ux = dx / len;
  const uy = dy / len;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const rx = ux * c - uy * s;
  const ry = ux * s + uy * c;
  const missLen = len * distScale;

  return { x: fx + (rx * missLen), y: fy + (ry * missLen) };
}

/**
 * Small utility to derive deterministic display seeds from entity ids.
 *
 * @param {number} sourceId
 * @param {number} targetId
 * @param {number} [salt=0]
 */
export function missSeedFromIds(sourceId, targetId, salt = 0) {
  const src = (Number(sourceId || 0) | 0) >>> 0;
  const dst = (Number(targetId || 0) | 0) >>> 0;
  return mix32((src * 2654435761) ^ ((dst * 2246822519) >>> 0) ^ (salt >>> 0));
}
