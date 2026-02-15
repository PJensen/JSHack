// rules/data/callbacks/eat.js
// Eat callback context and shared factory functions for corpse eating hooks.
// Callbacks are plain (ctx) => void functions invoked via runCallbackList.

import { RuleActionContext } from "../../utils/actionContexts.js";
import { Resistances } from "../../components/Resistences.js";

// ── EatCallbackContext ─────────────────────────────────────────────

/**
 * Context passed to corpse eat hook callbacks.
 * Mutations are queued and only applied on commit().
 */
export class EatCallbackContext extends RuleActionContext {
  /**
   * @param {any} world
   * @param {number} actor - the entity eating the corpse
   * @param {number} itemId - the corpse entity being eaten
   */
  constructor(world, actor, itemId) {
    super(world);
    this.actor = actor;
    this.itemId = itemId;
    this._postCommitEvents = [];
  }

  /**
   * Queue nutrition application (hunger/satiation update).
   * @param {number} nutrition
   */
  applyNutrition(nutrition) {
    const amount = Number(nutrition || 0);
    if (!Number.isFinite(amount) || amount === 0) return false;
    return this.queueMutation({ type: "nutrition", entityId: this.actor, nutrition: amount });
  }

  /** @param {string} eventName @param {any} payload */
  emit(eventName, payload) {
    this._postCommitEvents.push({ eventName, payload });
  }

  /**
   * Push a status effect onto the eating actor.
   * @param {{ key:string, turnsLeft:number, potency:number, stacks?:number, sourceId?:number }} effect
   */
  pushEffect(effect) {
    return super.pushEffect(this.actor, effect);
  }

  /**
   * Deal damage to the eating actor.
   * @param {number} amount
   * @param {string} [source]
   * @returns {number} damage dealt
   */
  damage(amount, source = "corpse") {
    return super.damage(this.actor, amount, source);
  }

  /**
   * Queue electric resistance grant on the eating actor.
   * @param {number} [minOhms]
   * @param {number} [fibrillationA]
   */
  grantElectricResistance(minOhms = 2400, fibrillationA = 0.03) {
    return this.queueMutation({
      type: "grantElectricResistance",
      entityId: this.actor,
      minOhms,
      fibrillationA,
    });
  }

  commit() {
    const applied = super.commit();
    if (this.cancelled) {
      this._postCommitEvents.length = 0;
      return applied;
    }
    for (let i = 0; i < this._postCommitEvents.length; i++) {
      const entry = this._postCommitEvents[i];
      try { this.world.emit && this.world.emit(entry.eventName, entry.payload); } catch {}
    }
    this._postCommitEvents.length = 0;
    return applied;
  }

  discard() {
    this._postCommitEvents.length = 0;
    return super.discard();
  }
}

// ── Factory functions ──────────────────────────────────────────────

/**
 * Push a status effect on eat → emit "hunger:sickened".
 * Used by rat/bat (disease), snake/spider (poison), wraith/lich (mindwipe), etc.
 * @param {string} effectKey
 * @param {number} turnsLeft
 * @param {number} potency
 * @param {string} [emitType] - defaults to effectKey
 */
export function corpseStatusEffect(effectKey, turnsLeft, potency, emitType) {
  return (ctx) => {
    ctx.pushEffect({ key: effectKey, turnsLeft, potency, stacks: 1, sourceId: ctx.itemId });
    ctx.emit("hunger:sickened", { actor: ctx.actor, type: emitType || effectKey });
  };
}

/**
 * Deal flat damage on eat.
 * Used by grid_bug (shock).
 */
export function corpseDamage(amount) {
  return (ctx) => {
    ctx.damage(amount, "corpse");
  };
}

/**
 * Grant electric resistance on eat.
 * Used by eel corpse.
 */
export function grantElectricResist(ctx) {
  const current = Number(ctx.world.get(ctx.actor, Resistances)?.electric?.ohms);
  const nextOhms = Number.isFinite(current) ? Math.max(current, 2400) : 2400;
  ctx.grantElectricResistance(2400, 0.03);
  ctx.emit("hunger:resistance-gained", { actor: ctx.actor, type: "electric", ohms: nextOhms });
}

/**
 * Cancel the eat action with a structured reason.
 * Useful for hard-gated corpse interactions.
 */
export function cancelEat(code, message, consumesTurn = true) {
  const reasonCode = String(code || "FAIL");
  const reasonMessage = String(message || "You cannot do that.");
  return (ctx) => {
    ctx.cancel({ code: reasonCode, message: reasonMessage, consumesTurn });
  };
}
