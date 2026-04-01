import { NamedIdentity } from "../components/NamedIdentity.js";
import { buildCatalogItem } from "../data/itemCatalogLoader.js";
import { getMonster } from "../data/monsters.js";
import { createEntityProxy } from "../interaction/entityProxy.js";
import { ActionTransaction } from "../interaction/mutations.js";
import { emitSafe } from "./emitSafe.js";

/**
 * Base helpers shared by first-class action contexts.
 * All mutations (damage, heal, pushEffect) are queued via ActionTransaction.
 * Call commit() to apply, or discard() to throw away.
 * Supports cancel()/fail() to prevent commit.
 */
export class RuleActionContext {
  /**
   * @param {import("../../lib/ecs-js/index.js").World} world
   */
  constructor(world) {
    this.world = world;
    this._queue = new ActionTransaction({ buildCatalogItem, getMonster });
    /** @type {Set<string>} */
    this._prevented = new Set();
  }

  // ── Cancellation ──────────────────────────────────────────────

  get cancelled() { return this._queue.cancelled; }
  get cancelReason() { return this._queue.cancelReason; }

  /**
   * Hard cancel: stops callback execution, prevents all queued mutations.
   * @param {{ code: string, message: string, consumesTurn?: boolean } | string} reason
   */
  cancel(reason) { this._queue.cancel(reason); }

  /**
   * Sugar for cancel with a FAIL code.
   * @param {string} message
   * @param {{ consumesTurn?: boolean }} [opts]
   */
  fail(message, opts) {
    this.cancel({ code: "FAIL", message, ...opts });
  }

  /**
   * Soft veto: sets a flag without stopping callback propagation.
   * Systems check isPrevented() to decide what to skip.
   * @param {string} flag
   */
  prevent(flag) { this._prevented.add(flag); }

  /**
   * @param {string} flag
   * @returns {boolean}
   */
  isPrevented(flag) { return this._prevented.has(flag); }

  // ── Queued mutations ──────────────────────────────────────────

  /**
   * @param {number} entityId
   * @param {number} amount
   * @param {string} [source]
   * @returns {number} the requested amount (applied on commit)
   */
  damage(entityId, amount, source = "action") {
    const dealt = Math.max(0, amount | 0);
    if (dealt <= 0) return 0;
    this._queue.enqueue({ type: "damage", entityId, amount: dealt, source });
    return dealt;
  }

  /**
   * @param {number} entityId
   * @param {number} amount
   * @returns {number} the requested amount (applied on commit)
   */
  heal(entityId, amount) {
    const delta = Math.max(0, amount | 0);
    if (delta <= 0) return 0;
    this._queue.enqueue({ type: "heal", entityId, amount: delta });
    return delta;
  }

  /**
   * @param {number} entityId
   * @param {{ key:string, turnsLeft:number, potency:number, stacks?:number, sourceId?:number }} effect
   */
  pushEffect(entityId, effect) {
    this._queue.enqueue({ type: "pushEffect", entityId, effect: { stacks: 1, ...effect } });
    return true;
  }

  /**
   * Queue a low-level mutation op.
   * Used by specialized action contexts that need extra mutation types.
   * @param {import("../interaction/mutations.js").MutationOp} op
   */
  queueMutation(op) {
    this._queue.enqueue(op);
    return true;
  }

  // ── Commit / Discard ──────────────────────────────────────────

  /** Apply all queued mutations. No-op if cancelled. */
  commit() { return this._queue.commit(this.world); }

  /** Throw away all queued mutations. */
  discard() { return this._queue.discard(); }

  // ── Non-mutating helpers (unchanged) ──────────────────────────

  /**
   * @param {string} eventName
   * @param {Record<string, any>} payload
   */
  emit(eventName, payload) {
    emitSafe(this.world, eventName, payload);
  }

  /**
   * @param {number} entityId
   * @returns {string}
   */
  getIdentity(entityId) {
    const ni = /** @type any */ (this.world.get(entityId, NamedIdentity));
    return String(ni?.identity || "");
  }

  // ── Reflective entity proxies ─────────────────────────────────

  /** @type {Map<number, Proxy>} */
  _proxyCache = new Map();

  /**
   * Get a read-only reflective proxy for an entity.
   * Cached per entity ID for the lifetime of this context.
   * @param {number} entityId
   * @returns {Proxy}
   */
  _proxy(entityId) {
    let p = this._proxyCache.get(entityId);
    if (!p) {
      p = createEntityProxy(this.world, entityId);
      this._proxyCache.set(entityId, p);
    }
    return p;
  }
}
