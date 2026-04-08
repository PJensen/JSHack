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
