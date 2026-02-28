// rules/data/callbacks/ai.js
// AI callback context and shared factory functions for monster AI hooks.
// Callbacks are plain (ctx) => void functions invoked via runCallbackList.

import { Position } from "../../components/Position.js";
import { findNearestValidTileAround } from "../../utils/queries.js";

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
    if (chance < 1 && ctx.world.rand() >= chance) return;
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
