// display/fx/bumpFxController.js
// Lunge animation for melee attacks: attacker's glyph briefly slides toward
// the target tile, then snaps back. Player lunges first; monsters get a
// staggered delay so the two phases read as distinct "sub-turns."
// Dual-wield: main-hand gets a full lunge, off-hand gets a shorter follow-up.
// Damage modulation: heavier hits lunge slightly further.

/** @typedef {{ dx:number, dy:number, elapsed:number, delay:number, duration:number, dist:number }} BumpState */

// ── Timing (seconds) ────────────────────────────────────────────────
const LUNGE_OUT   = 0.030;   // snap toward target — almost instant
const LUNGE_HOLD  = 0.055;   // hold at apex so the brain registers contact
const LUNGE_BACK  = 0.095;   // slow withdrawal sells weight
const TOTAL       = LUNGE_OUT + LUNGE_HOLD + LUNGE_BACK;

// Offhand: quicker, snappier follow-up
const OH_LUNGE_OUT  = 0.025;
const OH_LUNGE_HOLD = 0.040;
const OH_LUNGE_BACK = 0.070;
const OH_TOTAL      = OH_LUNGE_OUT + OH_LUNGE_HOLD + OH_LUNGE_BACK;

const LUNGE_DIST_BASE = 0.30;  // base tiles toward target at apex (main hand)
const LUNGE_DIST_OH   = 0.20;  // shorter offhand lunge

// Damage modulation: scale lunge dist by damage amount
// 1 damage = base, 10+ damage = up to 1.4x base
const DMG_SCALE_MIN = 1.0;
const DMG_SCALE_MAX = 1.4;
const DMG_SCALE_CAP = 10;      // damage at which scaling maxes out

// Stagger: monster lunges start this many seconds after the player's
const MONSTER_DELAY    = 0.10;
// Offhand attacks lunge again after a short gap (matches gore engine 150ms)
const OFFHAND_DELAY    = 0.15;

// ── Easing ──────────────────────────────────────────────────────────
// Strike: accelerate INTO the target (easeIn). Return: decelerate out (easeOut).
function easeOutQuad(t)  { return 1 - (1 - t) * (1 - t); }
function easeInQuad(t)   { return t * t; }

/**
 * Compute the fractional offset (0..1) for a main-hand lunge.
 * easeIn on strike (accelerates into target), easeOut on return (decelerates home).
 */
function lungeProgress(elapsed) {
  if (elapsed < 0) return 0;
  if (elapsed < LUNGE_OUT) {
    return easeInQuad(elapsed / LUNGE_OUT);
  }
  if (elapsed < LUNGE_OUT + LUNGE_HOLD) {
    return 1;
  }
  const retT = (elapsed - LUNGE_OUT - LUNGE_HOLD) / LUNGE_BACK;
  if (retT >= 1) return 0;
  return 1 - easeOutQuad(retT);
}

/**
 * Compute the fractional offset (0..1) for an off-hand lunge (faster snap).
 */
function offhandLungeProgress(elapsed) {
  if (elapsed < 0) return 0;
  if (elapsed < OH_LUNGE_OUT) {
    return easeInQuad(elapsed / OH_LUNGE_OUT);
  }
  if (elapsed < OH_LUNGE_OUT + OH_LUNGE_HOLD) {
    return 1;
  }
  const retT = (elapsed - OH_LUNGE_OUT - OH_LUNGE_HOLD) / OH_LUNGE_BACK;
  if (retT >= 1) return 0;
  return 1 - easeOutQuad(retT);
}

/**
 * Scale lunge distance by damage amount.
 */
function damageScale(damage) {
  if (!(damage > 0)) return DMG_SCALE_MIN;
  const t = Math.min(damage, DMG_SCALE_CAP) / DMG_SCALE_CAP;
  return DMG_SCALE_MIN + (DMG_SCALE_MAX - DMG_SCALE_MIN) * t;
}

// ── Controller ──────────────────────────────────────────────────────
export function createBumpFxController() {
  /**
   * Active bump animations keyed by attacker entity id.
   * Multiple bumps can be queued (main-hand then off-hand).
   * @type {Map<number, BumpState[]>}
   */
  const active = new Map();

  /**
   * Start a lunge animation for `attackerId` toward `targetX, targetY`.
   * @param {number} attackerId
   * @param {number} attackerX   attacker's current tile X
   * @param {number} attackerY   attacker's current tile Y
   * @param {number} targetX     target's tile X
   * @param {number} targetY     target's tile Y
   * @param {{ isPlayer?:boolean, offhand?:boolean, damage?:number }} [opts]
   */
  function trigger(attackerId, attackerX, attackerY, targetX, targetY, opts) {
    const rawDx = targetX - attackerX;
    const rawDy = targetY - attackerY;
    const mag = Math.hypot(rawDx, rawDy);
    if (!(mag > 0)) return;
    const dx = rawDx / mag;
    const dy = rawDy / mag;

    const isPlayer = !!(opts && opts.isPlayer);
    const offhand  = !!(opts && opts.offhand);
    const damage   = Number(opts && opts.damage) || 0;

    // Delay: monsters wait for player lunge to finish; offhand waits for main
    let delay = 0;
    if (offhand)        delay = OFFHAND_DELAY;
    else if (!isPlayer) delay = MONSTER_DELAY;

    // Lunge distance: offhand is shorter; both modulated by damage
    const baseDist = offhand ? LUNGE_DIST_OH : LUNGE_DIST_BASE;
    const dist = baseDist * damageScale(damage);
    const duration = offhand ? OH_TOTAL : TOTAL;

    const queue = active.get(attackerId);
    const entry = { dx, dy, elapsed: 0, delay, duration, dist, offhand };
    if (queue) {
      queue.push(entry);
    } else {
      active.set(attackerId, [entry]);
    }
  }

  /**
   * Advance all active bump animations.
   * @param {number} dt  seconds since last frame
   */
  function tick(dt) {
    for (const [id, queue] of active) {
      let i = 0;
      while (i < queue.length) {
        const b = queue[i];
        b.elapsed += dt;
        if (b.elapsed - b.delay >= b.duration) {
          queue.splice(i, 1);
        } else {
          i++;
        }
      }
      if (queue.length === 0) active.delete(id);
    }
  }

  /**
   * Get the current visual offset for an entity (additive to its tile pos).
   * Returns { dx:0, dy:0 } when no lunge is active.
   * @param {number} id
   * @returns {{ dx:number, dy:number }}
   */
  function getOffset(id) {
    const queue = active.get(id);
    if (!queue || queue.length === 0) return _ZERO;

    // Sum offsets from all active bumps (main + offhand can overlap briefly)
    let ox = 0, oy = 0;
    for (let i = 0; i < queue.length; i++) {
      const b = queue[i];
      const t = b.elapsed - b.delay;
      const progressFn = b.offhand ? offhandLungeProgress : lungeProgress;
      const p = progressFn(t) * b.dist;
      ox += b.dx * p;
      oy += b.dy * p;
    }
    return { dx: ox, dy: oy };
  }

  /**
   * Returns true if the entity has an active bump animation.
   * @param {number} id
   * @returns {boolean}
   */
  function isActive(id) {
    const queue = active.get(id);
    return !!(queue && queue.length > 0);
  }

  /**
   * Wire up world event listeners.
   * Listens to 'bump:attack' for main-hand melee lunges.
   * Listens to 'damaged' with offhand flag for off-hand follow-up lunges.
   * Damage amount modulates lunge distance for both.
   * @param {{ world:any, getPosition:(id:number)=>({x:number,y:number}|null), isPlayer:(id:number)=>boolean }} deps
   */
  function installListeners({ world, getPosition, isPlayer }) {
    // Main-hand lunge on bump:attack (fires before damage resolves)
    world.on('bump:attack', ({ attacker, target }) => {
      const a = Number(attacker || 0) | 0;
      const t = Number(target || 0) | 0;
      if (!(a > 0) || !(t > 0)) return;
      const apos = getPosition(a);
      const tpos = getPosition(t);
      if (!apos || !tpos) return;
      trigger(a, apos.x, apos.y, tpos.x, tpos.y, {
        isPlayer: isPlayer(a),
        offhand: false,
      });
    });

    // Update main-hand lunge distance when damage is known
    world.on('damaged', ({ source, target, amount, offhand }) => {
      const a = Number(source || 0) | 0;
      const t = Number(target || 0) | 0;
      if (!(a > 0) || !(t > 0)) return;
      const apos = getPosition(a);
      const tpos = getPosition(t);
      if (!apos || !tpos) return;

      if (offhand) {
        // Off-hand: queue a second, shorter lunge
        trigger(a, apos.x, apos.y, tpos.x, tpos.y, {
          isPlayer: isPlayer(a),
          offhand: true,
          damage: amount,
        });
      } else {
        // Main-hand: retroactively scale the active lunge by damage
        const queue = active.get(a);
        if (queue && queue.length > 0) {
          const last = queue[queue.length - 1];
          if (!last.offhand) {
            last.dist = LUNGE_DIST_BASE * damageScale(amount);
          }
        }
      }
    });
  }

  /** Remove tracking for a dead / despawned entity. */
  function remove(id) {
    active.delete(id);
  }

  return { trigger, tick, getOffset, isActive, installListeners, remove };
}

const _ZERO = Object.freeze({ dx: 0, dy: 0 });
