/**
 * Canonical tracker for deferred projectile-damage impacts.
 *
 * When a ranged attack / spell deals damage, the rules layer applies HP
 * immediately but the projectile VFX need time to reach the target.  This
 * tracker records each deferred damage event so that every display system
 * (health bars, gore, death-loot arcs) can query a single source of truth
 * for "has the projectile visually arrived yet?"
 *
 * Usage:
 *   import { impactTracker } from "./projectileImpactTracker.js";
 *   impactTracker.record(entityId, damageAmount, fxArriveTime);
 *   const displayHp = impactTracker.visualHp(entityId, actualHp, maxHp, fxTime);
 *   impactTracker.flush(fxTime);   // call once per frame
 */

/** @type {Map<number, Array<{ amount:number, arriveAt:number }>>} */
const _pending = new Map();

/**
 * Record a deferred damage event (projectile in flight).
 * @param {number} id     Target entity id
 * @param {number} amount Damage dealt (already applied to Vitality)
 * @param {number} arriveAt  fxTime when the projectile will visually impact
 */
function record(id, amount, arriveAt) {
  let q = _pending.get(id);
  if (!q) { q = []; _pending.set(id, q); }
  q.push({ amount, arriveAt });
}

/**
 * Return the HP value that should be displayed right now.
 * Adds back any damage whose projectile hasn't arrived yet.
 * @param {number} id        Target entity id
 * @param {number} actualHp  Real HP from Vitality
 * @param {number} maxHp     Max HP
 * @param {number} fxTime    Current display-side time
 * @returns {number}
 */
function visualHp(id, actualHp, maxHp, fxTime) {
  const q = _pending.get(id);
  if (!q || q.length === 0) return actualHp;
  let addBack = 0;
  for (let i = 0; i < q.length; i++) {
    if (fxTime < q[i].arriveAt) addBack += q[i].amount;
  }
  return Math.min(maxHp, actualHp + addBack);
}

/**
 * Latest pending arrival time for an entity, or 0 if none.
 * Useful for gore / death-loot timing.
 * @param {number} id
 * @param {number} fxTime  Current display-side time
 * @returns {number}
 */
function impactTimeFor(id, fxTime) {
  const q = _pending.get(id);
  if (!q) return 0;
  let latest = 0;
  for (let i = 0; i < q.length; i++) {
    if (q[i].arriveAt > fxTime && q[i].arriveAt > latest) latest = q[i].arriveAt;
  }
  return latest;
}

/**
 * Remaining delay (seconds) until last pending impact, or 0.
 * Drop-in replacement for the old _pendingProjectileDelay map.
 * @param {number} id
 * @param {number} fxTime
 * @returns {number}
 */
function delayFor(id, fxTime) {
  const t = impactTimeFor(id, fxTime);
  return t > fxTime ? t - fxTime : 0;
}

/**
 * Remove all entries for an entity (e.g. on death cleanup / floor transition).
 * @param {number} id
 */
function clear(id) {
  _pending.delete(id);
}

/**
 * Expire entries whose arrival time has passed.  Call once per frame.
 * @param {number} fxTime  Current display-side time
 */
function flush(fxTime) {
  for (const [id, q] of _pending) {
    for (let i = q.length - 1; i >= 0; i--) {
      if (fxTime >= q[i].arriveAt) q.splice(i, 1);
    }
    if (q.length === 0) _pending.delete(id);
  }
}

export const impactTracker = { record, visualHp, impactTimeFor, delayFor, clear, flush };
