// rules/data/callbacks/eat.js
// Eat callback context and shared factory functions for corpse eating hooks.
// Callbacks are plain (ctx) => void functions invoked via runCallbackList.

import { ActiveEffects } from "../../components/ActiveEffects.js";
import { Hunger } from "../../components/Hunger.js";
import { Resistances } from "../../components/Resistences.js";
import { Traits } from "../../components/Traits.js";
import { dealDamage } from "../../utils/dealDamage.js";
import { upsertTimedEffect } from "../../utils/effectSemantics.js";

// ── EatCallbackContext ─────────────────────────────────────────────

/**
 * Context passed to corpse eat hook callbacks.
 * Standalone queued context for corpse-eat hooks.
 */
export class EatCallbackContext {
  /**
   * @param {any} world
   * @param {number} actor - the entity eating the corpse
   * @param {number} itemId - the corpse entity being eaten
   */
  constructor(world, actor, itemId) {
    this.world = world;
    this.actor = actor;
    this.itemId = itemId;
    this._cancelled = false;
    this._cancelReason = null;
    this._mutations = [];
    this._postCommitEvents = [];
  }

  get cancelled() { return this._cancelled; }
  get cancelReason() { return this._cancelReason; }

  /**
   * @param {{ code: string, message: string, consumesTurn?: boolean } | string} reason
   */
  cancel(reason) {
    this._cancelled = true;
    this._cancelReason = typeof reason === "string"
      ? { code: "FAIL", message: reason, consumesTurn: true }
      : reason || { code: "FAIL", message: "Cancelled", consumesTurn: true };
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
    return this.queueMutation({ type: "pushEffect", entityId: this.actor, effect: { stacks: 1, ...effect } });
  }

  /**
   * Deal damage to the eating actor.
   * @param {number} amount
   * @param {string} [source]
   * @returns {number} damage dealt
   */
  damage(amount, source = "corpse") {
    const value = Math.max(0, amount | 0);
    if (value <= 0) return 0;
    this.queueMutation({ type: "damage", entityId: this.actor, amount: value, source });
    return value;
  }

  /**
   * Deterministic RNG chance check.
   * @param {number} prob - 0.0–1.0
   * @returns {boolean}
   */
  chance(prob) {
    if (prob >= 1) return true;
    if (prob <= 0) return false;
    return this.world.rand() < prob;
  }

  /**
   * Queue a trait field update on the eating actor.
   * @param {string} key - Traits component field name
   * @param {*} value
   */
  setTrait(key, value) {
    return this.queueMutation({ type: "setTrait", entityId: this.actor, key, value });
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

  /**
   * @param {any} op
   */
  queueMutation(op) {
    this._mutations.push(op);
    return true;
  }

  _applyNutrition(op) {
    const hunger = this.world.get(op.entityId, Hunger);
    if (!hunger) return;
    const amount = Number(op.nutrition || 0);
    if (!Number.isFinite(amount) || amount === 0) return;
    const nextHunger = Number(hunger.hunger || 0) - amount;
    if (nextHunger < 0) {
      hunger.hunger = 0;
      hunger.satiation = Math.min(200, Number(hunger.satiation || 0) + Math.abs(nextHunger));
      return;
    }
    hunger.hunger = nextHunger;
  }

  _applyPushEffect(op) {
    let ae = this.world.get(op.entityId, ActiveEffects);
    if (!ae || !Array.isArray(ae.effects)) {
      try { this.world.add(op.entityId, ActiveEffects, { effects: [] }); } catch {}
      ae = this.world.get(op.entityId, ActiveEffects);
    }
    if (!ae || !Array.isArray(ae.effects)) return;
    upsertTimedEffect(ae.effects, { stacks: 1, ...(op.effect || {}) });
  }

  _applySetTrait(op) {
    const key = String(op.key || "");
    if (!key) return;
    let tr = this.world.get(op.entityId, Traits);
    if (!tr) {
      try { this.world.add(op.entityId, Traits, {}); } catch {}
      tr = this.world.get(op.entityId, Traits);
    }
    if (tr) tr[key] = op.value;
  }

  _applyElectricResistance(op) {
    let resist = this.world.get(op.entityId, Resistances);
    if (!resist) {
      try { this.world.add(op.entityId, Resistances, {}); } catch {}
      resist = this.world.get(op.entityId, Resistances);
    }
    if (!resist) return;
    if (!resist.electric || typeof resist.electric !== "object") resist.electric = {};
    const currentOhms = Number(resist.electric.ohms);
    const nextOhms = Number(op.minOhms || 2400);
    resist.electric.ohms = Number.isFinite(currentOhms)
      ? Math.max(currentOhms, nextOhms)
      : nextOhms;
    if (!Number.isFinite(Number(resist.electric.fibrillationA))) {
      resist.electric.fibrillationA = Number(op.fibrillationA || 0.03);
    }
  }

  commit() {
    if (this.cancelled) {
      this._mutations.length = 0;
      this._postCommitEvents.length = 0;
      return [];
    }
    const applied = [];
    for (let i = 0; i < this._mutations.length; i++) {
      const op = this._mutations[i];
      switch (op?.type) {
        case "nutrition":
          this._applyNutrition(op);
          break;
        case "pushEffect":
          this._applyPushEffect(op);
          break;
        case "damage":
          dealDamage(this.world, {
            target: op.entityId,
            amount: op.amount,
            cause: String(op.source || "corpse"),
          });
          break;
        case "grantElectricResistance":
          this._applyElectricResistance(op);
          break;
        case "setTrait":
          this._applySetTrait(op);
          break;
        default:
          break;
      }
      applied.push(op);
    }
    this._mutations.length = 0;
    for (let i = 0; i < this._postCommitEvents.length; i++) {
      const entry = this._postCommitEvents[i];
      try { this.world.emit && this.world.emit(entry.eventName, entry.payload); } catch (e) { console.debug('[eat] emit ' + entry.eventName + ' failed:', e); }
    }
    this._postCommitEvents.length = 0;
    return applied;
  }

  discard() {
    this._mutations.length = 0;
    this._postCommitEvents.length = 0;
    return [];
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

// ── Trait progression factories ──────────────────────────────────

const IRON_STOMACH_THRESHOLD = 3;

/**
 * Track rat/bat corpse consumption. After eating IRON_STOMACH_THRESHOLD
 * disease-carrying corpses, grant the iron_stomach permanent trait.
 */
export function corpseIronStomachProgress(ctx) {
  const traits = ctx.world.get(ctx.actor, Traits);
  if (traits?.iron_stomach) return;
  const count = (Number(traits?.ratCorpsesEaten) || 0) + 1;
  ctx.setTrait("ratCorpsesEaten", count);
  if (count >= IRON_STOMACH_THRESHOLD) {
    ctx.setTrait("iron_stomach", true);
    ctx.emit("corpse:trait-gained", {
      actor: ctx.actor,
      trait: "iron_stomach",
      name: "Iron Stomach",
    });
  }
}
