// display/fx/recoilFxController.js
// Defender recoil animation: when an entity takes damage, its glyph briefly
// jolts away from the impact direction, then settles back.
// Impulse-sensitive: recoil magnitude scales with damage, direction follows
// the impact vector (melee: attacker→target, ranged: projectile travel dir).
// Ranged hits defer recoil until the projectile visually arrives.
// Offhand hits produce a lighter, delayed follow-up recoil.

/** @typedef {{ dx:number, dy:number, elapsed:number, delay:number, outDur:number, holdDur:number, backDur:number, dist:number }} RecoilState */

// ── Timing (seconds) ────────────────────────────────────────────────
const RECOIL_OUT  = 0.035;   // snap away from impact (fast)
const RECOIL_HOLD = 0.020;   // hold at peak displacement
const RECOIL_BACK = 0.110;   // slow settle back to origin

// Offhand: lighter follow-up
const OH_RECOIL_OUT  = 0.025;
const OH_RECOIL_HOLD = 0.015;
const OH_RECOIL_BACK = 0.080;

// ── Distance (tiles) ───────────────────────────────────────────────
const RECOIL_DIST_BASE  = 0.12;  // baseline recoil (1 damage)
const RECOIL_DIST_OH    = 0.08;  // offhand baseline
const RECOIL_DIST_MAX   = 0.28;  // cap for huge hits
const RECOIL_DIST_OH_MAX = 0.18;

// Damage scaling: logarithmic so 1dmg is noticeable, 20+ is big, 50+ caps
const DMG_LOG_BASE = 1.0;
const DMG_LOG_SCALE = 8.0;  // higher = slower ramp

// Critical hits get a multiplier
const CRIT_MULT = 1.35;

// ── Easing ──────────────────────────────────────────────────────────
function easeOutCubic(t) { return 1 - (1 - t) * (1 - t) * (1 - t); }
function easeInQuad(t)   { return t * t; }

/**
 * Compute fractional offset (0..1) for a recoil.
 * Quick snap out, brief hold, slow ease back.
 */
function recoilProgress(elapsed, outDur, holdDur, backDur) {
  if (elapsed < 0) return 0;
  if (elapsed < outDur) {
    return easeOutCubic(elapsed / outDur);
  }
  if (elapsed < outDur + holdDur) {
    return 1;
  }
  const retT = (elapsed - outDur - holdDur) / backDur;
  if (retT >= 1) return 0;
  return 1 - easeInQuad(retT);
}

/**
 * Scale recoil distance by damage amount (logarithmic curve).
 */
function damageScale(damage, base, max) {
  if (!(damage > 0)) return base;
  const t = Math.log(1 + damage / DMG_LOG_SCALE) / Math.log(1 + 50 / DMG_LOG_SCALE);
  return base + (max - base) * Math.min(1, t);
}

// ── Controller ──────────────────────────────────────────────────────
export function createRecoilFxController() {
  /**
   * Active recoil animations keyed by target entity id.
   * @type {Map<number, RecoilState[]>}
   */
  const active = new Map();

  /**
   * Start a recoil animation for `targetId` away from impact direction.
   * @param {number} targetId
   * @param {number} dx  Impact direction X (normalized, attacker→target or projectile travel dir)
   * @param {number} dy  Impact direction Y (normalized)
   * @param {{ offhand?:boolean, damage?:number, critical?:boolean, delay?:number }} [opts]
   */
  function trigger(targetId, dx, dy, opts) {
    const offhand  = !!(opts && opts.offhand);
    const damage   = Number(opts && opts.damage) || 0;
    const critical = !!(opts && opts.critical);
    const delay    = Number(opts && opts.delay) || 0;

    const base = offhand ? RECOIL_DIST_OH  : RECOIL_DIST_BASE;
    const max  = offhand ? RECOIL_DIST_OH_MAX : RECOIL_DIST_MAX;
    let dist = damageScale(damage, base, max);
    if (critical) dist *= CRIT_MULT;

    const outDur  = offhand ? OH_RECOIL_OUT  : RECOIL_OUT;
    const holdDur = offhand ? OH_RECOIL_HOLD : RECOIL_HOLD;
    const backDur = offhand ? OH_RECOIL_BACK : RECOIL_BACK;

    const entry = { dx, dy, elapsed: 0, delay, outDur, holdDur, backDur, dist };
    const queue = active.get(targetId);
    if (queue) {
      queue.push(entry);
    } else {
      active.set(targetId, [entry]);
    }
  }

  /**
   * Advance all active recoil animations.
   * @param {number} dt  Seconds since last frame
   */
  function tick(dt) {
    for (const [id, queue] of active) {
      let i = 0;
      while (i < queue.length) {
        const r = queue[i];
        r.elapsed += dt;
        const totalDur = r.outDur + r.holdDur + r.backDur;
        if (r.elapsed - r.delay >= totalDur) {
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
   * Returns { dx:0, dy:0 } when no recoil is active.
   * @param {number} id
   * @returns {{ dx:number, dy:number }}
   */
  function getOffset(id) {
    const queue = active.get(id);
    if (!queue || queue.length === 0) return _ZERO;

    let ox = 0, oy = 0;
    for (let i = 0; i < queue.length; i++) {
      const r = queue[i];
      const t = r.elapsed - r.delay;
      const p = recoilProgress(t, r.outDur, r.holdDur, r.backDur) * r.dist;
      // Recoil pushes AWAY from impact — same direction as impact vector
      ox += r.dx * p;
      oy += r.dy * p;
    }
    return { dx: ox, dy: oy };
  }

  /**
   * Returns true if the entity has an active recoil animation.
   * @param {number} id
   * @returns {boolean}
   */
  function isActive(id) {
    const queue = active.get(id);
    return !!(queue && queue.length > 0);
  }

  /**
   * Wire up world event listeners.
   * Listens to 'damaged' for recoil on the target entity.
   * @param {{ world:any, getPosition:(id:number)=>({x:number,y:number}|null), isPlayer:(id:number)=>boolean }} deps
   */
  function installListeners({ world, getPosition, isPlayer }) {
    world.on('damaged', ({
      source, target, amount, offhand, critical,
      impactVector, projectileDelay,
    }) => {
      // Ranged only — require an impact vector (projectile travel direction)
      if (!impactVector || (!impactVector.dx && !impactVector.dy)) return;

      const tid = Number(target || 0) | 0;
      if (!(tid > 0)) return;

      const dx = impactVector.dx;
      const dy = impactVector.dy;

      // Delay: ranged hits defer until projectile arrives visually
      const delay = Number(projectileDelay) || 0;

      // Offhand recoil: stagger after main-hand (match bumpFx 150ms gap)
      const ohDelay = offhand ? 0.15 : 0;

      trigger(tid, dx, dy, {
        offhand: !!offhand,
        damage: amount,
        critical: !!critical,
        delay: delay + ohDelay,
      });
    });
  }

  /** Remove tracking for a dead / despawned entity. */
  function remove(id) {
    active.delete(id);
  }

  return { trigger, tick, getOffset, isActive, installListeners, remove };
}

const _ZERO = Object.freeze({ dx: 0, dy: 0 });
