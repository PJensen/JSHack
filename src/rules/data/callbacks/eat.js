// rules/data/callbacks/eat.js
// Eat callback context and shared factory functions for corpse eating hooks.
// Callbacks are plain (ctx) => void functions invoked via runCallbackList.

import { ActiveEffects } from "../../components/ActiveEffects.js";
import { Resistances } from "../../components/Resistences.js";
import { Vitality } from "../../components/Vitality.js";

// ── EatCallbackContext ─────────────────────────────────────────────

/**
 * Context passed to corpse eat hook callbacks.
 * Provides pushEffect(), damage(), emit() targeting the eating actor.
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
  }

  get cancelled() { return this._cancelled; }
  get cancelReason() { return this._cancelReason; }

  cancel(reason) {
    this._cancelled = true;
    this._cancelReason = typeof reason === "string"
      ? { code: reason, message: reason }
      : reason || { code: "CANCELLED", message: "Cancelled" };
  }

  /** @param {string} eventName @param {any} payload */
  emit(eventName, payload) {
    try { this.world.emit && this.world.emit(eventName, payload); } catch {}
  }

  /**
   * Push a status effect onto the eating actor.
   * @param {{ key:string, turnsLeft:number, potency:number, stacks?:number, sourceId?:number }} effect
   */
  pushEffect(effect) {
    let ae = this.world.get(this.actor, ActiveEffects);
    if (!ae) {
      try { this.world.add(this.actor, ActiveEffects, { effects: [] }); ae = this.world.get(this.actor, ActiveEffects); } catch {}
    }
    if (!ae || !Array.isArray(ae.effects)) return;
    ae.effects.push(effect);
  }

  /**
   * Deal damage to the eating actor.
   * @param {number} amount
   * @param {string} [source]
   * @returns {number} damage dealt
   */
  damage(amount, source = "corpse") {
    const vit = this.world.get(this.actor, Vitality);
    if (!vit) return 0;
    const dmg = Math.max(0, amount | 0);
    if (dmg <= 0) return 0;
    vit.hp = Math.max(0, (vit.hp | 0) - dmg);
    try { this.world.emit && this.world.emit("damage", { id: this.actor, amount: dmg, source }); } catch {}
    return dmg;
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
  let resist = ctx.world.get(ctx.actor, Resistances);
  if (!resist) {
    try { ctx.world.add(ctx.actor, Resistances, {}); } catch {}
    resist = ctx.world.get(ctx.actor, Resistances);
  }
  if (!resist) return;
  const current = Number(resist?.electric?.ohms);
  const nextOhms = Number.isFinite(current)
    ? Math.max(current, 2400)
    : 2400;
  if (!resist.electric || typeof resist.electric !== "object") resist.electric = {};
  resist.electric.ohms = nextOhms;
  if (!Number.isFinite(resist.electric.fibrillationA)) resist.electric.fibrillationA = 0.03;
  ctx.emit("hunger:resistance-gained", { actor: ctx.actor, type: "electric", ohms: nextOhms });
}
