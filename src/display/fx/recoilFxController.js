// display/fx/recoilFxController.js
// Defender recoil animation: when an entity takes damage, its glyph briefly
// jolts away from the impact direction, then settles back.
// Impulse-sensitive: recoil magnitude scales with damage, direction follows
// the impact vector (melee: attacker→target, ranged: projectile travel dir).
// Ranged hits defer recoil until the projectile visually arrives.
// Offhand hits produce a lighter, delayed follow-up recoil.

/** @typedef {{ dx:number, dy:number, elapsed:number, delay:number, outDur:number, holdDur:number, backDur:number, dist:number, rot:number }} RecoilState */

// ── Timing (seconds) ────────────────────────────────────────────────
const RECOIL_OUT  = 0.030;   // snap away from impact (fast)
const RECOIL_HOLD = 0.045;   // hold at peak — let the brain register the wince
const RECOIL_BACK = 0.120;   // slow settle back to origin

// Offhand: lighter follow-up
const OH_RECOIL_OUT  = 0.025;
const OH_RECOIL_HOLD = 0.030;
const OH_RECOIL_BACK = 0.090;

// Melee: tighter, punchier — keeps cadence with the attacker's lunge
const MELEE_RECOIL_OUT  = 0.025;
const MELEE_RECOIL_HOLD = 0.050;
const MELEE_RECOIL_BACK = 0.100;

// ── Distance (tiles) ───────────────────────────────────────────────
const RECOIL_DIST_BASE  = 0.12;  // baseline recoil (1 damage)
const RECOIL_DIST_OH    = 0.08;  // offhand baseline
const RECOIL_DIST_MAX   = 0.28;  // cap for huge hits
const RECOIL_DIST_OH_MAX = 0.18;
const MELEE_RECOIL_DIST_BASE = 0.10;
const MELEE_RECOIL_DIST_MAX  = 0.22;

// ── Rotation (radians) — glyph tilts away from impact ──────────────
const ROT_BASE      = 0.06;   // baseline tilt (~3.4°)
const ROT_MAX       = 0.18;   // cap for huge hits (~10.3°)
const ROT_CRIT_MULT = 1.5;

// Damage scaling: logarithmic so 1dmg is noticeable, 20+ is big, 50+ caps
const DMG_LOG_BASE = 1.0;
const DMG_LOG_SCALE = 8.0;  // higher = slower ramp

// Critical hits get a multiplier
const CRIT_MULT = 1.35;

// ── Mass modulation ────────────────────────────────────────────────
// Lighter creatures recoil more, heavier ones less.
// Reference mass = 80 kg (humanoid baseline). Multiplier = sqrt(ref / mass).
const MASS_REF = 80;
const MASS_MULT_MIN = 0.7;   // floor for XL / very heavy
const MASS_MULT_MAX = 1.35;  // cap for XS / very light

// Fallback: if only sizeClass is available (no massKg)
const SIZE_CLASS_MASS = { XS: 3, S: 25, M: 80, L: 200, XL: 500 };

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
   * @param {{ offhand?:boolean, melee?:boolean, damage?:number, critical?:boolean, delay?:number, massKg?:number, sizeClass?:string }} [opts]
   */
  function trigger(targetId, dx, dy, opts) {
    const offhand  = !!(opts && opts.offhand);
    const melee    = !!(opts && opts.melee);
    const damage   = Number(opts && opts.damage) || 0;
    const critical = !!(opts && opts.critical);
    const delay    = Number(opts && opts.delay) || 0;

    const base = offhand ? RECOIL_DIST_OH  : RECOIL_DIST_BASE;
    const max  = offhand ? RECOIL_DIST_OH_MAX : RECOIL_DIST_MAX;
    // Melee: skip positional recoil — both combatants lunge at each other
    // simultaneously, so positional recoil fights the attacker's own lunge.
    // Rotation-only wince reads cleanly on a separate visual channel.
    let dist = melee ? 0 : damageScale(damage, base, max);
    if (!melee && critical) dist *= CRIT_MULT;

    // Mass modulation: light creatures recoil more, heavy ones less
    const rawMass = Number(opts && opts.massKg) || 0;
    const mass = rawMass > 0 ? rawMass : (SIZE_CLASS_MASS[opts && opts.sizeClass] || MASS_REF);
    const massMult = Math.max(MASS_MULT_MIN, Math.min(MASS_MULT_MAX, Math.sqrt(MASS_REF / mass)));
    dist *= massMult;

    // Rotation: tilt away from impact — cross product sign gives direction
    // dx,dy is impact direction; rotation tilts perpendicular to it
    let rot = damageScale(damage, ROT_BASE, ROT_MAX);
    if (critical) rot *= ROT_CRIT_MULT;
    rot *= massMult;
    // Tilt direction: use cross product of impact with "up" (0,-1) → sign = dx
    // Positive dx → tilt clockwise; negative dx → tilt counter-clockwise
    // For vertical hits, use a small fixed direction so it doesn't look dead
    if (Math.abs(dx) > 0.01) {
      rot *= Math.sign(dx);
    } else {
      rot *= (dy > 0 ? 1 : -1);
    }

    const outDur  = melee ? MELEE_RECOIL_OUT  : (offhand ? OH_RECOIL_OUT  : RECOIL_OUT);
    const holdDur = melee ? MELEE_RECOIL_HOLD : (offhand ? OH_RECOIL_HOLD : RECOIL_HOLD);
    const backDur = melee ? MELEE_RECOIL_BACK : (offhand ? OH_RECOIL_BACK : RECOIL_BACK);

    const entry = { dx, dy, elapsed: 0, delay, outDur, holdDur, backDur, dist, rot };
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
   * Get the current visual offset + rotation for an entity.
   * Returns { dx:0, dy:0, rotation:0 } when no recoil is active.
   * @param {number} id
   * @returns {{ dx:number, dy:number, rotation:number }}
   */
  function getOffset(id) {
    const queue = active.get(id);
    if (!queue || queue.length === 0) return _ZERO;

    let ox = 0, oy = 0, orot = 0;
    for (let i = 0; i < queue.length; i++) {
      const r = queue[i];
      const t = r.elapsed - r.delay;
      const p = recoilProgress(t, r.outDur, r.holdDur, r.backDur);
      // Positional recoil pushes AWAY from impact
      ox += r.dx * p * r.dist;
      oy += r.dy * p * r.dist;
      // Rotation wince
      orot += p * r.rot;
    }
    return { dx: ox, dy: oy, rotation: orot };
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
      cause, impactVector, projectileDelay,
      sizeClass, massKg,
    }) => {
      const tid = Number(target || 0) | 0;
      if (!(tid > 0)) return;

      const isMelee = cause === 'melee';
      const delay = Number(projectileDelay) || 0;
      const isProjectile = delay > 0;

      // Melee: rotation-only wince (no positional recoil — both sides lunge)
      if (isMelee) {
        const sid = Number(source || 0) | 0;
        if (!(sid > 0)) return;
        const spos = getPosition(sid);
        const tpos = getPosition(tid);
        if (!spos || !tpos) return;
        const rawDx = tpos.x - spos.x;
        const rawDy = tpos.y - spos.y;
        const mag = Math.hypot(rawDx, rawDy);
        if (!(mag > 0)) return;
        trigger(tid, rawDx / mag, rawDy / mag, {
          melee: true,
          offhand: !!offhand,
          damage: amount,
          critical: !!critical,
          delay: 0,
          massKg,
          sizeClass,
        });
        return;
      }

      // Full recoil + rotation: projectile spells / arrows
      if (isProjectile) {
        let dx = 0, dy = 0;
        if (impactVector && (impactVector.dx || impactVector.dy)) {
          dx = impactVector.dx;
          dy = impactVector.dy;
        } else {
          const sid = Number(source || 0) | 0;
          if (!(sid > 0)) return;
          const spos = getPosition(sid);
          const tpos = getPosition(tid);
          if (!spos || !tpos) return;
          const rawDx = tpos.x - spos.x;
          const rawDy = tpos.y - spos.y;
          const mag = Math.hypot(rawDx, rawDy);
          if (!(mag > 0)) return;
          dx = rawDx / mag;
          dy = rawDy / mag;
        }
        trigger(tid, dx, dy, {
          offhand: false,
          damage: amount,
          critical: !!critical,
          delay,
          massKg,
          sizeClass,
        });
        return;
      }

      // Small flinch: non-melee non-projectile (DoTs, AoE, instant spells)
      const angle = Math.random() * Math.PI * 2;
      trigger(tid, Math.cos(angle), Math.sin(angle), {
        offhand: false,
        damage: Math.min(amount, 3),
        critical: false,
        delay: 0,
        massKg,
        sizeClass,
      });
    });
  }

  /** Remove tracking for a dead / despawned entity. */
  function remove(id) {
    active.delete(id);
  }

  return { trigger, tick, getOffset, isActive, installListeners, remove };
}

const _ZERO = Object.freeze({ dx: 0, dy: 0, rotation: 0 });
