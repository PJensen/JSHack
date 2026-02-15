import { Brain } from "../components/Brain.js";
import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Potion } from "../components/Potion.js";
import { getSpell } from "../data/spells.js";
import { createEntityProxy } from "../interaction/entityProxy.js";
import { MutationQueue } from "../interaction/mutations.js";
import { runSpellScript } from "../scripts/spells.js";

/**
 * Base helpers shared by first-class action contexts.
 * All mutations (damage, heal, pushEffect) are queued via MutationQueue.
 * Call commit() to apply, or discard() to throw away.
 * Supports cancel()/fail() to prevent commit.
 */
export class RuleActionContext {
  /**
   * @param {import("../../lib/ecs-js/index.js").World} world
   */
  constructor(world) {
    this.world = world;
    this._queue = new MutationQueue();
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
    try { this.world.emit && this.world.emit(eventName, payload); } catch {}
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

export class ItemUseActionContext extends RuleActionContext {
  /**
   * @param {{
   *   world: import("../../lib/ecs-js/index.js").World,
   *   actor: number,
   *   itemId: number,
   *   intent: { targetId?: number } | null,
   *   info: { type?:string, description?:string, count?:number } | null,
   *   identity: string,
   * }} init
   */
  constructor(init) {
    super(init.world);
    this._actorId = init.actor | 0;
    this.itemId = init.itemId | 0;
    this.intent = init.intent || null;
    this.info = init.info || null;
    this.identity = String(init.identity || "").toLowerCase();
  }

  /** Reflective proxy for the actor entity. */
  get actor() { return this._proxy(this._actorId); }

  /** Raw actor entity ID (for systems that need the number). */
  get actorId() { return this._actorId; }

  /**
   * @param {string} prefix
   */
  spellIdFromIdentity(prefix) {
    const normalizedPrefix = String(prefix || "").toLowerCase();
    if (!normalizedPrefix || !this.identity.startsWith(normalizedPrefix)) return "";
    return this.identity.slice(normalizedPrefix.length);
  }

  /**
   * @param {{ identityPrefix:string, targetMode?:"intentTarget"|"self"|"none", castEventSource?:string, consumeOnSuccess?:boolean }} opts
   */
  castSpellFromIdentity(opts) {
    const spellId = this.spellIdFromIdentity(opts.identityPrefix);
    if (!spellId) return false;
    const spell = getSpell(spellId);
    if (!spell) return false;
    const targetMode = String(opts?.targetMode || "self");
    const runIntent = targetMode === "intentTarget" ? { targetId: this.intent?.targetId } : {};
    try { runSpellScript(this.world, this._actorId, spell, runIntent); } catch { return false; }
    const castEvent = {
      actor: this._actorId,
      spellId: spell.id,
      targetId: targetMode === "intentTarget" ? (this.intent?.targetId || this._actorId) : this._actorId,
    };
    if (opts?.castEventSource) castEvent.source = opts.castEventSource;
    this.emit("castSpell", castEvent);
    return opts?.consumeOnSuccess !== false;
  }

  /**
   * @returns {{ learnedSpellIds?:string[] }|null}
   */
  ensureBrain() {
    let brain = /** @type any */ (this.world.get(this._actorId, Brain));
    if (!brain) {
      try { this.world.add(this._actorId, Brain, {}); } catch {}
      brain = /** @type any */ (this.world.get(this._actorId, Brain));
    }
    return brain || null;
  }

  /**
   * @param {{ identityPrefix:string, consumeOnSuccess?:boolean }} opts
   */
  learnSpellFromIdentity(opts) {
    const spellId = this.spellIdFromIdentity(opts.identityPrefix);
    if (!spellId) return false;
    const spell = getSpell(spellId);
    if (!spell) {
      this.emit("spell:learn-denied", { actor: this._actorId, reason: "unknown-spell", spellId });
      return false;
    }

    const brain = this.ensureBrain();
    if (!brain) {
      this.emit("spell:learn-denied", { actor: this._actorId, reason: "no-brain", spellId: spell.id });
      return false;
    }
    if (!Array.isArray(brain.learnedSpellIds)) brain.learnedSpellIds = [];
    if (brain.learnedSpellIds.includes(spell.id)) {
      this.emit("spell:already-known", { actor: this._actorId, spellId: spell.id });
      return false;
    }

    brain.learnedSpellIds.push(spell.id);
    this.emit("spell:learned", { actor: this._actorId, spellId: spell.id });
    return opts?.consumeOnSuccess !== false;
  }
}

export class ItemApplyActionContext extends RuleActionContext {
  /**
   * @param {{
   *   world: import("../../lib/ecs-js/index.js").World,
   *   actor: number,
   *   toolId: number,
   *   targetId: number,
   * }} init
   */
  constructor(init) {
    super(init.world);
    this._actorId = init.actor | 0;
    this.toolId = init.toolId | 0;
    this._targetId = init.targetId | 0;
  }

  /** Reflective proxy for the actor entity. */
  get actor() { return this._proxy(this._actorId); }

  /** Raw actor entity ID. */
  get actorId() { return this._actorId; }

  /** Reflective proxy for the target item entity. */
  get target() { return this._proxy(this._targetId); }

  /** Raw target entity ID. */
  get targetId() { return this._targetId; }

  /**
   * @returns {{items:number[]} | null}
   */
  getInventory() {
    return /** @type any */ (this.world.get(this._actorId, Inventory));
  }

  /**
   * @returns {boolean}
   */
  hasBothItemsInInventory() {
    const inv = this.getInventory();
    if (!inv || !Array.isArray(inv.items)) return false;
    return inv.items.includes(this.toolId) && inv.items.includes(this._targetId);
  }

  /**
   * @param {number} entityId
   * @returns {{type?:string,description?:string,count?:number,bonuses?:any,affixes?:string[]}|null}
   */
  getItemInfo(entityId) {
    return /** @type any */ (this.world.get(entityId, ItemInfo));
  }

  /**
   * @param {number} entityId
   * @returns {string}
   */
  getItemType(entityId) {
    return String(this.getItemInfo(entityId)?.type || "");
  }

  /**
   * @returns {string}
   */
  getToolIdentity() {
    return this.getIdentity(this.toolId);
  }

  /**
   * @returns {string}
   */
  getTargetIdentity() {
    return this.getIdentity(this._targetId);
  }

  /**
   * Queue consumption of one use/dose of the tool item.
   * Actual mutation deferred until commit().
   * @returns {boolean}
   */
  consumeTool() {
    const inv = this.getInventory();
    if (!inv || !Array.isArray(inv.items)) return false;
    if (!inv.items.includes(this.toolId)) return false;
    this._queue.enqueue({ type: "consume", entityId: this.toolId, inventoryOwnerId: this._actorId });
    return true;
  }
}
