import { combatSeed, hashString32, mulberry32 } from "./rng.js";

/**
 * Compute projectile travel delay based on distance and speed, clamped to bounds.
 * @param {{x?:number, y?:number}|null|undefined} from
 * @param {{x?:number, y?:number}|null|undefined} to
 * @param {number} speed
 * @param {number} minDuration
 * @param {number} maxDuration
 */
export function computeProjectileDelay(from, to, speed, minDuration, maxDuration) {
  const dx = Number(to?.x || 0) - Number(from?.x || 0);
  const dy = Number(to?.y || 0) - Number(from?.y || 0);
  const dist = Math.hypot(dx, dy);
  if (!(dist > 0) || !(speed > 0)) return Number(minDuration) || 0;
  const raw = dist / speed;
  return Math.max(Number(minDuration) || 0, Math.min(Number(maxDuration) || raw, raw));
}

/**
 * Normalized impact vector from two points.
 * @param {{x?:number, y?:number}|null|undefined} from
 * @param {{x?:number, y?:number}|null|undefined} to
 */
export function computeImpactVector(from, to) {
  const dx = Number(to?.x || 0) - Number(from?.x || 0);
  const dy = Number(to?.y || 0) - Number(from?.y || 0);
  const mag = Math.hypot(dx, dy);
  if (!(mag > 0)) return { dx: 0, dy: 1 };
  return { dx: dx / mag, dy: dy / mag };
}

/**
 * Normalized impact vector from integer coordinates.
 * @param {number} fromX
 * @param {number} fromY
 * @param {number} toX
 * @param {number} toY
 */
export function computeImpactVectorXY(fromX, fromY, toX, toY) {
  return computeImpactVector({ x: fromX, y: fromY }, { x: toX, y: toY });
}

/**
 * Deterministic miss endpoint offset from the direct projectile line.
 * Uses combat-seeded RNG so the same world/step/actors produce the same miss.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {{x?:number,y?:number}|null|undefined} from
 * @param {{x?:number,y?:number}|null|undefined} to
 * @param {{
 *   sourceId?:number,
 *   targetId?:number,
 *   key?:string,
 *   salt?:number,
 *   maxAngleDeg?:number,
 *   minDistanceScale?:number,
 *   distanceExtraScale?:number,
 * }} [options]
 */
export function computeMissEndpoint(world, from, to, options = {}) {
  const fx = Number(from?.x);
  const fy = Number(from?.y);
  const tx = Number(to?.x);
  const ty = Number(to?.y);
  if (!Number.isFinite(fx) || !Number.isFinite(fy) || !Number.isFinite(tx) || !Number.isFinite(ty)) {
    return { x: Number(to?.x || 0), y: Number(to?.y || 0) };
  }

  const dx = tx - fx;
  const dy = ty - fy;
  const len = Math.hypot(dx, dy);
  if (!(len > 0.000001)) return { x: tx, y: ty };

  const sourceId = Number(options?.sourceId || 0) | 0;
  const targetId = Number(options?.targetId || 0) | 0;
  const keyHash = hashString32(String(options?.key || "projectile:miss"));
  const salt = (Number(options?.salt || 0) | 0) ^ keyHash;
  const r = mulberry32(combatSeed(world.seed, world.step, sourceId, targetId, salt >>> 0));

  const maxAngleRad = (Math.PI / 180) * Math.max(0, Number(options?.maxAngleDeg || 15));
  const minDistanceScale = Math.max(1, Number(options?.minDistanceScale || 1.04));
  const distanceExtraScale = Math.max(0, Number(options?.distanceExtraScale || 0.12));
  const angle = ((r() * 2) - 1) * maxAngleRad;
  const distScale = minDistanceScale + (r() * distanceExtraScale);

  const ux = dx / len;
  const uy = dy / len;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const rx = (ux * c) - (uy * s);
  const ry = (ux * s) + (uy * c);
  const outLen = len * distScale;

  return { x: fx + (rx * outLen), y: fy + (ry * outLen) };
}
