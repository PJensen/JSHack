// rules/data/callbacks/ai.js
// AI callback context and shared factory functions for monster AI hooks.
// Callbacks are plain (ctx) => void functions invoked via runCallbackList.

import { Position } from "../../components/Position.js";
import { ActiveEffects } from "../../components/ActiveEffects.js";
import { WaitIntent } from "../../components/Intents/WaitIntent.js";
import { findNearestValidTileAround } from "../../utils/queries.js";
import { worldChance } from "../../utils/rng.js";

const SELF_THROW_COOLDOWN_KEY = Symbol.for("jshack:ai:selfThrowNearTargetOnSeen:cooldown");

function manhattan(a, b) {
  return Math.abs((a.x | 0) - (b.x | 0)) + Math.abs((a.y | 0) - (b.y | 0));
}

/**
 * @param {import("../../../lib/ecs-js/index.js").World} world
 * @returns {Map<string, number>}
 */
function ensureSelfThrowCooldownState(world) {
  const rec = world[SELF_THROW_COOLDOWN_KEY];
  if (rec instanceof Map) return rec;
  const created = new Map();
  world[SELF_THROW_COOLDOWN_KEY] = created;
  return created;
}

/**
 * @param {number} actor
 * @param {number} target
 * @returns {string}
 */
function selfThrowCooldownSlot(actor, target) {
  return `${actor | 0}:${target | 0}`;
}

/**
 * @param {import("../../../lib/ecs-js/index.js").World} world
 * @param {number} actor
 * @param {number} target
 * @returns {number}
 */
function getSelfThrowLastTurn(world, actor, target) {
  const store = ensureSelfThrowCooldownState(world);
  const last = Number(store.get(selfThrowCooldownSlot(actor, target)));
  return Number.isFinite(last) ? (last | 0) : -1e9;
}

/**
 * @param {import("../../../lib/ecs-js/index.js").World} world
 * @param {number} actor
 * @param {number} target
 * @param {number} cooldownTurns
 * @returns {boolean}
 */
function selfThrowOnCooldown(world, actor, target, cooldownTurns) {
  if (!(cooldownTurns > 0)) return false;
  const now = Number(world.step || 0) | 0;
  const last = getSelfThrowLastTurn(world, actor, target);
  return (now - last) < cooldownTurns;
}

/**
 * @param {import("../../../lib/ecs-js/index.js").World} world
 * @param {number} actor
 * @param {number} target
 */
function markSelfThrowUsed(world, actor, target) {
  const store = ensureSelfThrowCooldownState(world);
  store.set(selfThrowCooldownSlot(actor, target), Number(world.step || 0) | 0);
}

// ── SeenCallbackContext ───────────────────────────────────────────

/**
 * Context passed to monster AI sight callbacks.
 * Provides cancel(), emit(), and handled flag for "action consumed".
 */
export class SeenCallbackContext {
  /**
   * @param {any} world
   * @param {{
   *   actor: number,
   *   target: number,
   *   actorPos?: { x:number, y:number } | null,
   *   targetPos?: { x:number, y:number } | null,
   * }} frame
   */
  constructor(world, frame) {
    this.world = world;
    this._frame = frame;
    this._cancelled = false;
    this._cancelReason = null;
    this._handled = false;
  }

  get actor() { return this._frame.actor | 0; }
  get target() { return this._frame.target | 0; }

  get actorPos() {
    const pos = this.world.get(this.actor, Position);
    if (pos) return { x: pos.x | 0, y: pos.y | 0 };
    const fallback = this._frame.actorPos;
    return fallback ? { x: fallback.x | 0, y: fallback.y | 0 } : null;
  }

  get targetPos() {
    const pos = this.world.get(this.target, Position);
    if (pos) return { x: pos.x | 0, y: pos.y | 0 };
    const fallback = this._frame.targetPos;
    return fallback ? { x: fallback.x | 0, y: fallback.y | 0 } : null;
  }

  get cancelled() { return this._cancelled; }
  get cancelReason() { return this._cancelReason; }
  get handled() { return this._handled; }

  /**
   * @param {unknown} reason
   */
  cancel(reason) {
    this._cancelled = true;
    this._cancelReason = typeof reason === "string"
      ? { code: reason, message: reason }
      : reason || { code: "CANCELLED", message: "Cancelled" };
  }

  /** @param {boolean} [value] */
  setHandled(value = true) {
    this._handled = !!value;
  }

  /** @param {string} eventName @param {any} payload */
  emit(eventName, payload) {
    try { this.world.emit?.(eventName, payload); } catch (e) { console.debug("[ai] emit " + eventName + " failed:", e); }
  }
}

// ── Gaze exposure tracking ────────────────────────────────────────

const GAZE_EXPOSURE_KEY = Symbol.for('jshack:ai:gazeExposure');

/** @param {any} world @returns {Map<string, {count:number, lastTurn:number, waitCount:number}>} */
function ensureGazeExposureState(world) {
  if (world[GAZE_EXPOSURE_KEY] instanceof Map) return world[GAZE_EXPOSURE_KEY];
  const m = new Map();
  world[GAZE_EXPOSURE_KEY] = m;
  return m;
}

// ── Factory functions ─────────────────────────────────────────────

/**
 * Teleport-throw the monster near the seen target and optionally collide.
 * Landing is always on a valid walkable/unblocked tile, never on top of target.
 *
 * @param {{ searchRadius?: number, fallbackSearchRadius?: number, cooldownTurns?: number }} [opts]
 */
export function selfThrowNearTargetOnSeen(opts = {}) {
  const searchRadius = Math.max(1, Number.isFinite(opts.searchRadius) ? (Number(opts.searchRadius) | 0) : 1);
  const fallbackSearchRadius = Math.max(searchRadius, Number.isFinite(opts.fallbackSearchRadius) ? (Number(opts.fallbackSearchRadius) | 0) : 2);
  const cooldownTurns = Math.max(0, Number.isFinite(opts.cooldownTurns) ? (Number(opts.cooldownTurns) | 0) : 0);
  const chance = Number.isFinite(opts.chance) ? Math.max(0, Math.min(1, opts.chance)) : 1;

  return (ctx) => {
    if (!ctx || ctx.cancelled) return;
    if (!worldChance(ctx.world, chance)) return;
    const from = ctx.actorPos;
    const target = ctx.targetPos;
    if (!from || !target) return;
    if (selfThrowOnCooldown(ctx.world, ctx.actor, ctx.target, cooldownTurns)) return;

    const exclude = [
      { x: target.x | 0, y: target.y | 0 },
      { x: from.x | 0, y: from.y | 0 },
    ];

    let landing = findNearestValidTileAround(ctx.world, target, { maxDistance: searchRadius, exclude });
    if (!landing && fallbackSearchRadius > searchRadius) {
      landing = findNearestValidTileAround(ctx.world, target, { maxDistance: fallbackSearchRadius, exclude });
    }

    if (!landing) {
      if (manhattan(from, target) === 1) {
        ctx.emit("bump:attack", { attacker: ctx.actor, target: ctx.target, via: "onSeen:self-throw" });
        markSelfThrowUsed(ctx.world, ctx.actor, ctx.target);
        ctx.setHandled(true);
      }
      return;
    }

    ctx.world.set(ctx.actor, Position, { x: landing.x | 0, y: landing.y | 0 });
    ctx.emit("moved", {
      id: ctx.actor,
      from: { x: from.x | 0, y: from.y | 0 },
      to: { x: landing.x | 0, y: landing.y | 0 },
    });
    ctx.emit("item:thrown", {
      itemId: ctx.actor,
      from: { x: from.x | 0, y: from.y | 0 },
      to: { x: landing.x | 0, y: landing.y | 0 },
      targetId: ctx.target,
      source: "monster:onSeen",
      mode: "self-throw",
    });

    if (manhattan(landing, target) === 1) {
      ctx.emit("bump:attack", { attacker: ctx.actor, target: ctx.target, via: "onSeen:self-throw" });
    }
    markSelfThrowUsed(ctx.world, ctx.actor, ctx.target);
    ctx.setHandled(true);
  };
}

/**
 * Gaze aura: the monster must maintain LOS for `exposureTurns` consecutive turns
 * before mindwipe begins to stack. Breaking LOS resets the exposure counter.
 * Each turn in LOS emits an escalating `proc:gaze:message` event for UI wiring.
 *
 * @param {number} [stackLimit=4]   - max mindwipe stacks after exposure is complete
 * @param {number} [exposureTurns=5] - consecutive LOS turns before mindwipe applies
 */
export function gazeOnLOS(stackLimit = 4, exposureTurns = 5) {
  const limit    = Math.max(1, Math.trunc(stackLimit));
  const threshold = Math.max(1, Math.trunc(exposureTurns));

  /** Escalating messages: indices 0…threshold-2 are pre-effect warnings; index threshold-1 triggers mindwipe. */
  const MESSAGES = [
    "The Floating Eye's unblinking gaze washes over you.",
    "Your thoughts feel sluggish under its stare...",
    "The eye's gaze presses deeper into your mind.",
    "Your concentration is slipping away...",
    "The Floating Eye's gaze sears into your mind!",
  ];

  return (ctx) => {
    if (!ctx || ctx.cancelled) return;

    const now   = (Number(ctx.world.step) || 0) | 0;
    const store = ensureGazeExposureState(ctx.world);
    const slot  = `${ctx.actor | 0}:${ctx.target | 0}`;
    const rec   = store.get(slot) || { count: 0, lastTurn: -1e9, waitCount: 0 };

    // Reset counter if LOS was broken (gap of more than 1 turn)
    if (now - rec.lastTurn > 1) {
      rec.count = 0;
      rec.waitCount = 0;
    }

    rec.count++;
    rec.lastTurn = now;

    // Wait-stun track: only advances when player uses WAIT action this turn.
    // WaitIntent is still on the entity at this point (ai phase runs before intents phase).
    const isWaiting = !!ctx.world.get(ctx.target, WaitIntent);
    if (isWaiting) {
      rec.waitCount = (rec.waitCount || 0) + 1;
    } else {
      rec.waitCount = 0;
    }

    store.set(slot, rec);

    // Emit escalating message (turn 1 through threshold, capped at last message)
    const msgIdx = Math.min(rec.count - 1, MESSAGES.length - 1);
    ctx.emit('proc:gaze:message', {
      actor:   ctx.actor,
      target:  ctx.target,
      step:    rec.count,
      message: MESSAGES[msgIdx],
    });

    // Wait-stun: after threshold consecutive WAIT turns in gaze, player is paralyzed.
    if (isWaiting && rec.waitCount >= threshold) {
      rec.waitCount = 0;
      store.set(slot, rec);
      const aeStun = ctx.world.get(ctx.target, ActiveEffects);
      if (aeStun) {
        aeStun.effects.push({ key: 'stun', turnsLeft: 5, potency: 1, stacks: 1 });
        ctx.world.set(ctx.target, ActiveEffects, aeStun);
      }
      ctx.emit('proc:gaze:stun', { actor: ctx.actor, target: ctx.target });
      return;
    }

    // Emit visual countdown when player is actively waiting in gaze (not yet stunned).
    if (isWaiting && rec.waitCount > 0) {
      ctx.emit('proc:gaze:charged', {
        actor:     ctx.actor,
        target:    ctx.target,
        waitCount: rec.waitCount,
        total:     threshold,
      });
    }

    // No mindwipe effect until fully exposed (any-LOS counter)
    if (rec.count < threshold) return;

    const ae = ctx.world.get(ctx.target, ActiveEffects);
    if (!ae) return;
    const existing = ae.effects.find(e => e.key === 'mindwipe');
    if (existing) {
      const currentStacks = existing.stacks || 1;
      if (currentStacks < limit) {
        existing.stacks  = currentStacks + 1;
        existing.potency = existing.stacks;
      }
      existing.turnsLeft = Math.max(existing.turnsLeft, 3);
    } else {
      ae.effects.push({ key: 'mindwipe', turnsLeft: 3, potency: 1, stacks: 1 });
    }
    ctx.world.set(ctx.target, ActiveEffects, ae);
    ctx.emit('proc:gaze:mindwipe', {
      actor:  ctx.actor,
      target: ctx.target,
      stacks: ae.effects.find(e => e.key === 'mindwipe')?.stacks ?? 1,
    });
  };
}
