// display/fx/bumpFxController.js
// Lunge animation for melee attacks: attacker's glyph briefly slides toward
// the target tile, then snaps back. Player lunges first; monsters get a
// staggered delay so the two phases read as distinct "sub-turns."
// Dual-wield: main-hand gets a full lunge, off-hand gets a shorter follow-up.
// Damage modulation: heavier hits lunge slightly further.

/** @typedef {{ dx:number, dy:number, elapsed:number, delay:number, duration:number, dist:number, whiff?:boolean }} BumpState */

// ── Timing (seconds) ────────────────────────────────────────────────
const LUNGE_OUT   = 0.030;   // snap toward target — almost instant
const LUNGE_OVER  = 0.020;   // push-through overshoot past contact point
const LUNGE_HOLD  = 0.030;   // hold at apex so the brain registers contact
const LUNGE_BACK  = 0.075;   // slow withdrawal sells weight
const TOTAL       = LUNGE_OUT + LUNGE_OVER + LUNGE_HOLD + LUNGE_BACK;

// Overshoot: how far past 1.0 the lunge pushes (fraction of dist)
const OVERSHOOT_FRAC = 0.12;

// Offhand: quicker, snappier follow-up (lighter overshoot)
const OH_LUNGE_OUT  = 0.025;
const OH_LUNGE_OVER = 0.015;
const OH_LUNGE_HOLD = 0.025;
const OH_LUNGE_BACK = 0.070;
const OH_TOTAL      = OH_LUNGE_OUT + OH_LUNGE_OVER + OH_LUNGE_HOLD + OH_LUNGE_BACK;
const OH_OVERSHOOT_FRAC = 0.08;

const LUNGE_DIST_BASE = 0.30;  // base tiles toward target at apex (main hand)
const LUNGE_DIST_OH   = 0.20;  // shorter offhand lunge

// Damage modulation: scale lunge dist by damage amount
// 1 damage = base, 10+ damage = up to 1.4x base
const DMG_SCALE_MIN = 1.0;
const DMG_SCALE_MAX = 1.4;
const DMG_SCALE_CAP = 10;      // damage at which scaling maxes out

// Whiff: miss/dodge/parry — shorter reach, more overshoot (weapon swings through air)
const WHIFF_OUT   = 0.025;
const WHIFF_OVER  = 0.030;   // longer overshoot — no contact to arrest momentum
const WHIFF_HOLD  = 0.010;   // barely any hold — nothing to hit
const WHIFF_BACK  = 0.085;   // slow recovery sells the stumble
const WHIFF_TOTAL = WHIFF_OUT + WHIFF_OVER + WHIFF_HOLD + WHIFF_BACK;
const WHIFF_DIST  = 0.22;    // shorter reach than a connected hit
const WHIFF_OVERSHOOT = 0.20; // 20% overshoot — big swing through empty air

// Stagger: monster lunges start this many seconds after the player's
const MONSTER_DELAY    = 0.10;
// Offhand attacks lunge again after a short gap (matches gore engine 150ms)
const OFFHAND_DELAY    = 0.15;

// Struggle: short jerk toward intended direction, elastic snap-back.
// Sells "I tried to move but something is holding me."
const STRUGGLE_OUT  = 0.035;   // quick jerk
const STRUGGLE_HOLD = 0.015;   // brief hold at peak
const STRUGGLE_BACK = 0.120;   // slow elastic return
const STRUGGLE_TOTAL = STRUGGLE_OUT + STRUGGLE_HOLD + STRUGGLE_BACK;
const STRUGGLE_DIST  = 0.16;   // smaller than a real lunge — player barely budges

// ── Easing ──────────────────────────────────────────────────────────
// Strike: accelerate INTO the target (easeIn). Return: decelerate out (easeOut).
function easeOutQuad(t)  { return 1 - (1 - t) * (1 - t); }
function easeInQuad(t)   { return t * t; }

/**
 * Compute the fractional offset for a main-hand lunge.
 * Phases: snap out → overshoot past contact → settle to apex → hold → ease back.
 * Returns >1.0 during overshoot for that push-through weight.
 */
function lungeProgress(elapsed) {
  if (elapsed < 0) return 0;
  // Phase 1: accelerate toward target (0 → 1.0)
  if (elapsed < LUNGE_OUT) {
    return easeInQuad(elapsed / LUNGE_OUT);
  }
  // Phase 2: push through past contact (1.0 → 1+overshoot → 1.0)
  const t2 = elapsed - LUNGE_OUT;
  if (t2 < LUNGE_OVER) {
    const k = t2 / LUNGE_OVER;
    // sine bump: 0→1→0 mapped to 1.0→1+overshoot→1.0
    return 1 + OVERSHOOT_FRAC * Math.sin(k * Math.PI);
  }
  // Phase 3: hold at apex
  const t3 = t2 - LUNGE_OVER;
  if (t3 < LUNGE_HOLD) {
    return 1;
  }
  // Phase 4: ease back to origin
  const retT = (t3 - LUNGE_HOLD) / LUNGE_BACK;
  if (retT >= 1) return 0;
  return 1 - easeOutQuad(retT);
}

/**
 * Compute the fractional offset for an off-hand lunge (faster, lighter overshoot).
 */
function offhandLungeProgress(elapsed) {
  if (elapsed < 0) return 0;
  if (elapsed < OH_LUNGE_OUT) {
    return easeInQuad(elapsed / OH_LUNGE_OUT);
  }
  const t2 = elapsed - OH_LUNGE_OUT;
  if (t2 < OH_LUNGE_OVER) {
    const k = t2 / OH_LUNGE_OVER;
    return 1 + OH_OVERSHOOT_FRAC * Math.sin(k * Math.PI);
  }
  const t3 = t2 - OH_LUNGE_OVER;
  if (t3 < OH_LUNGE_HOLD) {
    return 1;
  }
  const retT = (t3 - OH_LUNGE_HOLD) / OH_LUNGE_BACK;
  if (retT >= 1) return 0;
  return 1 - easeOutQuad(retT);
}

/**
 * Whiff lunge: shorter reach, exaggerated overshoot, slow recovery.
 * Sells the "swing through air" feel of a miss.
 */
function whiffProgress(elapsed) {
  if (elapsed < 0) return 0;
  if (elapsed < WHIFF_OUT) {
    return easeInQuad(elapsed / WHIFF_OUT);
  }
  const t2 = elapsed - WHIFF_OUT;
  if (t2 < WHIFF_OVER) {
    const k = t2 / WHIFF_OVER;
    return 1 + WHIFF_OVERSHOOT * Math.sin(k * Math.PI);
  }
  const t3 = t2 - WHIFF_OVER;
  if (t3 < WHIFF_HOLD) {
    return 1;
  }
  const retT = (t3 - WHIFF_HOLD) / WHIFF_BACK;
  if (retT >= 1) return 0;
  return 1 - easeOutQuad(retT);
}

/**
 * Struggle jerk: quick snap out, tiny hold, slow elastic recoil.
 * Returns 0→1→0 with an overshoot on the return (rubber-band snap).
 */
function struggleProgress(elapsed) {
  if (elapsed < 0) return 0;
  if (elapsed < STRUGGLE_OUT) {
    return easeInQuad(elapsed / STRUGGLE_OUT);
  }
  const t2 = elapsed - STRUGGLE_OUT;
  if (t2 < STRUGGLE_HOLD) {
    return 1;
  }
  const retT = (t2 - STRUGGLE_HOLD) / STRUGGLE_BACK;
  if (retT >= 1) return 0;
  // Elastic overshoot on return: snaps past zero then settles
  const r = 1 - retT;
  return r * Math.cos(retT * Math.PI * 2.5) * (retT < 0.6 ? 1 : (1 - (retT - 0.6) / 0.4));
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

  /** @type {((b: BumpState) => void) | null} */
  let _onContact = null;

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
        const prevT = b.elapsed - b.delay;
        b.elapsed += dt;
        const currT = b.elapsed - b.delay;
        // Fire contact callback when lunge crosses apex (progress reaches 1.0)
        // For main-hand: apex is at LUNGE_OUT; offhand: at OH_LUNGE_OUT
        if (!b.contacted && !b.struggle && !b.whiff && _onContact && currT >= 0) {
          const apexTime = b.offhand ? OH_LUNGE_OUT : LUNGE_OUT;
          if (prevT < apexTime && currT >= apexTime) {
            b.contacted = true;
            _onContact(b);
          }
        }
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
      const progressFn = b.struggle ? struggleProgress : (b.whiff ? whiffProgress : (b.offhand ? offhandLungeProgress : lungeProgress));
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
   * Convert the active main-hand lunge for `attackerId` into a whiff animation.
   * Called when the attack misses, is dodged, or is parried — replaces the
   * normal lunge with a shorter, faster animation that overshoots through air.
   * @param {number} attackerId
   */
  function convertToWhiff(attackerId) {
    const queue = active.get(attackerId | 0);
    if (!queue) return;
    for (let i = queue.length - 1; i >= 0; i--) {
      const b = queue[i];
      if (!b.offhand && !b.whiff) {
        b.whiff = true;
        b.dist = WHIFF_DIST;
        b.duration = WHIFF_TOTAL;
        // Reset elapsed to replay from start with new timing
        b.elapsed = b.delay;
        break;
      }
    }
  }

  /**
   * Wire up world event listeners.
   * Listens to 'bump:attack' for main-hand melee lunges.
   * Listens to 'damaged' with offhand flag for off-hand follow-up lunges.
   * Listens to miss/dodge/parry to convert lunges into whiff animations.
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

    // Miss / dodge / parry → convert attacker's lunge into a whiff
    world.on('status', (ev) => {
      if (ev && ev.kind === 'miss' && ev.source) convertToWhiff(Number(ev.source) | 0);
    });
    world.on('combat:dodge', ({ attacker }) => {
      if (attacker) convertToWhiff(Number(attacker) | 0);
    });
    world.on('combat:parry', ({ attacker }) => {
      if (attacker) convertToWhiff(Number(attacker) | 0);
    });

    // Insufficient stamina → convert lunge into a struggle jerk
    world.on('attack:insufficient-stamina', ({ attacker }) => {
      const a = Number(attacker || 0) | 0;
      if (!(a > 0)) return;
      const queue = active.get(a);
      if (!queue) return;
      for (let i = queue.length - 1; i >= 0; i--) {
        const b = queue[i];
        if (!b.offhand && !b.struggle) {
          b.struggle = true;
          b.dist = STRUGGLE_DIST;
          b.duration = STRUGGLE_TOTAL;
          b.elapsed = b.delay;
          break;
        }
      }
    });

    // Struggle jerk when slowed actor tries to move
    world.on('movement:slowed', ({ actor, x, y, dx, dy }) => {
      const a = Number(actor || 0) | 0;
      if (!(a > 0)) return;
      const mag = Math.hypot(dx, dy);
      if (!(mag > 0)) return;
      const ndx = dx / mag;
      const ndy = dy / mag;

      const queue = active.get(a);
      const entry = {
        dx: ndx, dy: ndy,
        elapsed: 0,
        delay: 0,
        duration: STRUGGLE_TOTAL,
        dist: STRUGGLE_DIST,
        struggle: true,
      };
      if (queue) {
        queue.push(entry);
      } else {
        active.set(a, [entry]);
      }
    });
  }

  /** Remove tracking for a dead / despawned entity. */
  function remove(id) {
    active.delete(id);
  }

  /** Register a callback fired when a lunge reaches its contact point (apex). */
  function onContact(fn) { _onContact = fn; }

  return { trigger, convertToWhiff, tick, getOffset, isActive, installListeners, remove, onContact };
}

const _ZERO = Object.freeze({ dx: 0, dy: 0 });
