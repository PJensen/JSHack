// rules/data/callbacks/eat.js
// Eat callback context and shared factory functions for corpse eating hooks.
// Callbacks are plain (ctx) => void functions invoked via runCallbackList.

import { attach, children } from "../../../lib/ecs-js/index.js";
import { ActiveEffects } from "../../components/ActiveEffects.js";
import { CorpseAdaptation } from "../../components/CorpseAdaptation.js";
import { DerivedExpression } from "../../components/DerivedExpression.js";
import { Hunger } from "../../components/Hunger.js";
import { Resistances } from "../../components/Resistences.js";
import { NamedIdentity } from "../../components/NamedIdentity.js";
import { Vitality } from "../../components/Vitality.js";
import { Traits } from "../../components/Traits.js";
import { dealDamage } from "../../utils/dealDamage.js";
import { upsertTimedEffect } from "../../utils/effectSemantics.js";
import { ensureActiveEffects } from "../../utils/effects.js";
import { effectiveMaxHp } from "../../utils/passiveBonuses.js";
import { emitSafe } from "../../utils/emitSafe.js";

// -- EatCallbackContext --

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
   * @param {number} prob - 0.0-1.0
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
   * Queue a corpse adaptation child entity (DerivedExpression + CorpseAdaptation marker).
   * @param {string} statKey - canonical stat key (e.g. "poisonResist", "kineticDR")
   * @param {number} value - addConst bonus value
   * @param {string} source - monster id (e.g. "cave_snake")
   * @param {string} label - display label (e.g. "poison")
   */
  addCorpseAdaptation(statKey, value, source, label) {
    return this.queueMutation({
      type: "addCorpseAdaptation",
      entityId: this.actor,
      statKey: String(statKey || ""),
      value: Number(value),
      source: String(source || ""),
      label: String(label || ""),
    });
  }

  /**
   * Sum all existing CorpseAdaptation DerivedExpression values for a given stat key.
   * @param {string} statKey - canonical stat key to sum
   * @returns {number}
   */
  sumCorpseAdaptations(statKey) {
    let total = 0;
    for (const childId of children(this.world, this.actor)) {
      const ca = this.world.get(childId, CorpseAdaptation);
      if (!ca || ca.statKey !== statKey) continue;
      const expr = this.world.get(childId, DerivedExpression);
      if (expr) total += Number(expr.value || 0);
    }
    return total;
  }

  /**
   * Heal HP on the eating actor.
   * @param {number} amount
   */
  heal(amount) {
    const value = Math.max(0, amount | 0);
    if (value <= 0) return 0;
    this.queueMutation({ type: "heal", entityId: this.actor, amount: value });
    return value;
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
    const ae = ensureActiveEffects(this.world, op.entityId);
    if (!ae) return;
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

  _applyCorpseAdaptation(op) {
    const statKey = String(op.statKey || "");
    const value = Number(op.value || 0);
    if (!statKey || !Number.isFinite(value) || value === 0) return;
    const childId = this.world.create();
    this.world.add(childId, DerivedExpression, {
      target: statKey, kind: "addConst", value,
      stage: "base", priority: 100, enabled: true,
      source: "", factor: 0,
    });
    this.world.add(childId, CorpseAdaptation, {
      source: String(op.source || ""),
      label: String(op.label || ""),
      statKey,
    });
    attach(this.world, childId, op.entityId);
  }

  _applyHeal(op) {
    const vit = this.world.get(op.entityId, Vitality);
    if (!vit) return;
    const amount = Math.max(0, Number(op.amount) | 0);
    vit.hp = Math.min(effectiveMaxHp(this.world, op.entityId, vit), vit.hp + amount);
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
        case "setTrait":
          this._applySetTrait(op);
          break;
        case "addCorpseAdaptation":
          this._applyCorpseAdaptation(op);
          break;
        case "heal":
          this._applyHeal(op);
          break;
        default:
          break;
      }
      applied.push(op);
    }
    this._mutations.length = 0;
    for (let i = 0; i < this._postCommitEvents.length; i++) {
      const entry = this._postCommitEvents[i];
      emitSafe(this.world, entry.eventName, entry.payload);
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

// -- Factory functions --

function readEatHealthPct(ctx, subject = "target") {
  const who = String(subject || "target") === "source" ? ctx.actor : ctx.actor;
  const vit = ctx?.world?.get?.(who, Vitality);
  const maxHp = Number(vit?.maxHp || 0);
  if (!(maxHp > 0)) return 1;
  return Number(vit?.hp || 0) / maxHp;
}

function readEatSourceStat(ctx, statKey) {
  const key = String(statKey || "");
  if (!key) return 0;
  if (typeof ctx?.stats?.value === "function") {
    const direct = ctx.stats.value(ctx.actor, key, "melee");
    if (Number.isFinite(direct)) return Number(direct);
  }
  if (typeof ctx?.stats?.actor === "function") {
    const snap = ctx.stats.actor("melee") || ctx.stats.actor();
    const fromSnap = Number(snap?.[key]);
    if (Number.isFinite(fromSnap)) return fromSnap;
  }
  return 0;
}

function hasEatTag(ctx, tag) {
  const wanted = String(tag || "");
  if (!wanted) return false;

  if (wanted === "eat" || wanted === "consume" || wanted === "corpse") return true;

  const status = ctx?.world?.get?.(ctx.actor, ActiveEffects);
  if (Array.isArray(status?.effects) && status.effects.some((entry) => String(entry?.key || "") === wanted)) {
    return true;
  }

  const traits = ctx?.world?.get?.(ctx.actor, Traits);
  if (traits && traits[wanted] === true) return true;

  const identity = ctx?.world?.get?.(ctx.actor, NamedIdentity);
  if (String(identity?.identity || "") === wanted) return true;

  return false;
}

function evalEatProcGate(ctx, gate) {
  const kind = String(gate?.kind || "");
  switch (kind) {
    case "eventKind":
      return String(gate?.a || "") === "eat";
    case "chance":
      return ctx.chance(Number(gate?.b || 0));
    case "sourceStatAtLeast":
      return readEatSourceStat(ctx, gate?.a) >= Number(gate?.b || 0);
    case "healthBelowPct":
      return readEatHealthPct(ctx, gate?.c || "target") < Number(gate?.b || 0);
    case "targetTag":
      return hasEatTag(ctx, gate?.a);
    case "hasActionTag":
      return String(gate?.a || "") === "eat";
    default:
      return false;
  }
}

function applyEatProcEffect(ctx, effect) {
  const kind = String(effect?.kind || "");
  switch (kind) {
    case "applyStatus":
      ctx.pushEffect({
        key: String(effect?.a || ""),
        turnsLeft: Math.max(0, Number(effect?.b || 0)),
        potency: Number(effect?.c || 1),
        stacks: 1,
        sourceId: ctx.itemId,
      });
      return;
    case "attachTimedBuff":
      ctx.pushEffect({
        key: String(effect?.a || ""),
        turnsLeft: Math.max(0, Number(effect?.b || 0)),
        potency: Number(effect?.c || 1),
        stacks: 1,
        sourceId: ctx.itemId,
      });
      return;
    case "heal":
      ctx.heal(Number(effect?.a || effect?.b || 0));
      return;
    case "dealDamage":
      ctx.damage(Number(effect?.a || effect?.b || 0), String(effect?.c || "corpse"));
      return;
    case "nutrition":
      ctx.applyNutrition(Number(effect?.a || effect?.b || 0));
      return;
    case "setTrait":
      ctx.setTrait(String(effect?.a || ""), effect?.b);
      return;
    case "addCorpseAdaptation":
      ctx.addCorpseAdaptation(
        String(effect?.a || ""),
        Number(effect?.b || 0),
        String(effect?.c || ""),
        String(effect?.d || effect?.a || "")
      );
      return;
    case "emitEvent":
      ctx.emit(
        String(effect?.a || ""),
        effect?.b && typeof effect.b === "object" ? { ...effect.b } : effect?.b
      );
      return;
    default:
      return;
  }
}

function createEatProcApi(ctx) {
  return Object.freeze({
    applyStatus(key, turnsLeft, potency = 1) {
      ctx.pushEffect({ key: String(key || ""), turnsLeft: Math.max(0, Number(turnsLeft || 0)), potency: Number(potency || 1), stacks: 1, sourceId: ctx.itemId });
    },
    attachTimedBuff(key, duration, potency = 1) {
      ctx.pushEffect({ key: String(key || ""), turnsLeft: Math.max(0, Number(duration || 0)), potency: Number(potency || 1), stacks: 1, sourceId: ctx.itemId });
    },
    heal(amount) {
      ctx.heal(Number(amount || 0));
    },
    dealDamage(amount, source = "corpse") {
      ctx.damage(Number(amount || 0), String(source || "corpse"));
    },
    addNutrition(amount) {
      ctx.applyNutrition(Number(amount || 0));
    },
    setTrait(key, value) {
      ctx.setTrait(String(key || ""), value);
    },
    addCorpseAdaptation(statKey, value, source, label) {
      ctx.addCorpseAdaptation(String(statKey || ""), Number(value || 0), String(source || ""), String(label || ""));
    },
    emit(eventName, payload) {
      ctx.emit(String(eventName || ""), payload && typeof payload === "object" ? { ...payload } : payload);
    },
    cancel(reason) {
      ctx.cancel(reason);
    },
  });
}

/**
 * ProcNode-style corpse-eat hook.
 * Supports a compact gates/effects/script shape inspired by ProcNode authoring.
 *
 * @param {{
 *   gates?: Array<{kind:string,a?:any,b?:any,c?:any,d?:any}>,
 *   effects?: Array<any>,
 *   script?: (ctx:any, api:any) => void,
 * }} spec
 */
export function corpseProcNode(spec = {}) {
  const gates = Array.isArray(spec?.gates) ? spec.gates : [];
  const effects = Array.isArray(spec?.effects) ? spec.effects : [];
  const script = typeof spec?.script === "function" ? spec.script : null;

  return (ctx) => {
    for (let i = 0; i < gates.length; i++) {
      if (!evalEatProcGate(ctx, gates[i])) return;
    }

    for (let i = 0; i < effects.length; i++) {
      const effect = effects[i];
      if (typeof effect === "function") {
        effect(ctx, createEatProcApi(ctx));
        continue;
      }
      applyEatProcEffect(ctx, effect);
    }

    if (script) script(ctx, createEatProcApi(ctx));
  };
}

// -- Legacy convenience wrappers (delegate to corpseProcNode) --
// These exist for readability and gradual migration; prefer explicit
// corpseProcNode(...) specs in content files for maximum composability.

/**
 * Push a status effect on eat -> emit "hunger:sickened".
 * Used by rat/bat (disease), snake/spider (poison), wraith/lich (mindwipe), etc.
 * @deprecated Prefer explicit corpseProcNode({ effects, script }) in data files.
 * @param {string} effectKey
 * @param {number} turnsLeft
 * @param {number} potency
 * @param {string} [emitType] - defaults to effectKey
 */
export function corpseStatusEffect(effectKey, turnsLeft, potency, emitType) {
  return corpseProcNode({
    gates: [{ kind: "eventKind", a: "eat" }],
    effects: [{ kind: "applyStatus", a: effectKey, b: turnsLeft, c: potency }],
    script: (ctx, proc) => {
      proc.emit("hunger:sickened", { actor: ctx.actor, type: emitType || effectKey });
    },
  });
}

/**
 * Deal flat damage on eat.
 * Used by grid_bug (shock).
 * @deprecated Prefer explicit corpseProcNode({ effects }) in data files.
 */
export function corpseDamage(amount) {
  return corpseProcNode({
    gates: [{ kind: "eventKind", a: "eat" }],
    effects: [{ kind: "dealDamage", a: amount, c: "corpse" }],
  });
}

/**
 * Grant electric resistance on eat via stat tree.
 * Used by eel corpse. Adds electricOhms bonus (diminishing, cap ~2400 total bonus).
 * Canonical special-case helper retained for concise diminishing adaptation logic.
 */
export function grantElectricResist(ctx) {
  const run = corpseProcNode({
    gates: [{ kind: "eventKind", a: "eat" }],
    script: (innerCtx, proc) => {
      const currentBonus = innerCtx.sumCorpseAdaptations("electricOhms");
      const ceiling = 2400;
      const increment = 600;
      const headroom = Math.max(0, 1 - currentBonus / ceiling);
      const delta = Math.round(increment * headroom);
      if (delta <= 0) return;
      proc.addCorpseAdaptation("electricOhms", delta, "eel", "electric");
      proc.emit("hunger:resistance-gained", {
        actor: innerCtx.actor,
        type: "electric",
        ohms: currentBonus + delta,
      });
    },
  });
  run(ctx);
}

/**
 * Cancel the eat action with a structured reason.
 * Useful for hard-gated corpse interactions.
 * @deprecated Prefer explicit corpseProcNode({ script }) in data files.
 */
export function cancelEat(code, message, consumesTurn = true) {
  const reasonCode = String(code || "FAIL");
  const reasonMessage = String(message || "You cannot do that.");
  return corpseProcNode({
    gates: [{ kind: "eventKind", a: "eat" }],
    script: (_ctx, proc) => {
      proc.cancel({ code: reasonCode, message: reasonMessage, consumesTurn });
    },
  });
}

// -- Legacy generic wrappers (delegate to corpseProcNode) --

/**
 * Apply a timed buff/debuff on eat.
 * @deprecated Prefer explicit corpseProcNode({ effects, script }) in data files.
 * @param {string} effectKey
 * @param {number} turnsLeft
 * @param {number} potency
 * @param {string} [emitEvent] - event name to emit (defaults to "corpse:buff-gained")
 * @param {string} [description] - flavor text for emit payload
 */
export function corpseTimedBuff(effectKey, turnsLeft, potency, emitEvent, description) {
  return corpseProcNode({
    gates: [{ kind: "eventKind", a: "eat" }],
    effects: [{ kind: "attachTimedBuff", a: effectKey, b: turnsLeft, c: potency }],
    script: (ctx, proc) => {
      proc.emit(emitEvent || "corpse:buff-gained", {
        actor: ctx.actor,
        effect: effectKey,
        turnsLeft,
        description: description || effectKey,
      });
    },
  });
}

/**
 * Chance-gated dual outcome: roll once, apply good OR bad callback.
 * @deprecated Prefer explicit corpseProcNode({ gates/effects/script }) in data files.
 * @param {number} goodChance - 0.0-1.0 probability of the good outcome
 * @param {Function} goodCb - callback if lucky
 * @param {Function} badCb - callback if unlucky
 */
export function corpseGamble(goodChance, goodCb, badCb) {
  return corpseProcNode({
    gates: [{ kind: "eventKind", a: "eat" }],
    script: (ctx) => {
      if (ctx.chance(goodChance)) {
        if (typeof goodCb === "function") goodCb(ctx);
      } else {
        if (typeof badCb === "function") badCb(ctx);
      }
    },
  });
}

/**
 * Grant bonus nutrition on eat.
 * @deprecated Prefer explicit corpseProcNode({ effects }) in data files.
 * @param {number} amount
 */
export function corpseBonusNutrition(amount) {
  return corpseProcNode({
    gates: [{ kind: "eventKind", a: "eat" }],
    effects: [{ kind: "nutrition", a: amount }],
  });
}

/**
 * Heal HP on eat.
 * @deprecated Prefer explicit corpseProcNode({ effects, script }) in data files.
 * @param {number} amount
 */
export function corpseHeal(amount) {
  return corpseProcNode({
    gates: [{ kind: "eventKind", a: "eat" }],
    effects: [{ kind: "heal", a: amount }],
    script: (ctx, proc) => {
      proc.emit("corpse:buff-gained", {
        actor: ctx.actor,
        effect: "heal",
        description: "vitality surges through you",
      });
    },
  });
}

/**
 * Diminishing-returns resistance via DerivedExpression stat tree.
 * Each eat creates a child entity with a smaller addConst bonus.
 * For multiplier resists (poisonResist, fireResist): higher bonus = more resist.
 *
 * Formula: delta = (1 - floor - currentBonus) * (1 - decay)
 * The max total bonus is capped at (1 - floor), so the effective mult never
 * drops below floor.
 *
 * Example (poisonResist, decay 0.85, floor 0.4, maxBonus 0.6):
 *   eat 1: delta=0.09, total=0.09
 *   eat 2: delta=0.077, total=0.167
 *   eat 5: total≈0.35
 *
 * Canonical special-case helper retained to keep diminishing formulas centralized.
 *
 * @param {string} statKey  - canonical stat key (e.g. "poisonResist", "fireResist")
 * @param {number} decay    - 0–1, higher = slower convergence
 * @param {number} floor    - minimum multiplier (max bonus = 1 - floor)
 * @param {string} [label]  - display name for the resistance type
 * @param {string} [source] - monster id for attribution
 */
export function corpseDiminishResist(statKey, decay, floor, label, source) {
  const maxBonus = 1.0 - floor;
  return (ctx) => {
    const currentBonus = ctx.sumCorpseAdaptations(statKey);
    const remaining = Math.max(0, maxBonus - currentBonus);
    const delta = Math.round(remaining * (1 - decay) * 100) / 100;
    if (delta <= 0) return;
    ctx.addCorpseAdaptation(statKey, delta, source || "", label || statKey);
    const totalBonus = currentBonus + delta;
    const pct = Math.round(totalBonus * 100);
    ctx.emit("corpse:resist-building", {
      actor: ctx.actor,
      type: label || statKey,
      value: 1.0 - totalBonus,
      pct,
    });
  };
}

/**
 * Diminishing-returns flat DR via DerivedExpression stat tree.
 * Each eat creates a child entity with a smaller addConst bonus.
 *
 * Formula: delta = increment * max(0, 1 - (baseDR + currentBonus) / ceiling)
 * Reads the Resistances component for baseDR so the ceiling accounts for
 * both innate DR and corpse-sourced DR.
 *
 * @param {string} statKey    - canonical stat key (e.g. "kineticDR")
 * @param {string} baseChannel - Resistances channel (e.g. "kinetic")
 * @param {string} baseField   - Resistances field (e.g. "DR")
 * @param {number} increment  - base amount added per eat (before diminishing)
 * @param {number} ceiling    - max total DR reachable (base + corpse bonuses)
 * @param {string} [label]    - display name
 * @param {string} [source]   - monster id for attribution
 *
 * Canonical special-case helper retained to keep diminishing formulas centralized.
 */
export function corpseDiminishDR(statKey, baseChannel, baseField, increment, ceiling, label, source) {
  return (ctx) => {
    const resist = ctx.world.get(ctx.actor, Resistances);
    const baseDR = Number(resist?.[baseChannel]?.[baseField]) || 0;
    const currentBonus = ctx.sumCorpseAdaptations(statKey);
    const effectiveDR = baseDR + currentBonus;
    const headroom = Math.max(0, 1 - effectiveDR / ceiling);
    const delta = Math.round(increment * headroom * 100) / 100;
    if (delta <= 0) return;
    ctx.addCorpseAdaptation(statKey, delta, source || "", label || statKey);
    ctx.emit("corpse:resist-building", {
      actor: ctx.actor,
      type: label || statKey,
      value: effectiveDR + delta,
    });
  };
}

// -- Trait progression factories --

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

/**
 * Generic trait progression factory. Eat N corpses of a type to gain a permanent trait.
 * @param {string} counterKey - Traits field for the counter (e.g. "snakesEaten")
 * @param {number} threshold - how many corpses needed
 * @param {string} traitKey - Traits field for the boolean (e.g. "serpent_blood")
 * @param {string} traitName - display name (e.g. "Serpent Blood")
 * @param {Function} [onGrantCb] - optional callback invoked on trait grant (receives ctx)
 */
export function corpseProgression(counterKey, threshold, traitKey, traitName, onGrantCb) {
  return (ctx) => {
    const traits = ctx.world.get(ctx.actor, Traits);
    if (traits?.[traitKey]) return;
    const count = (Number(traits?.[counterKey]) || 0) + 1;
    ctx.setTrait(counterKey, count);
    if (count < threshold) {
      ctx.emit("corpse:progression", {
        actor: ctx.actor,
        trait: traitKey,
        name: traitName,
        count,
        threshold,
      });
    }
    if (count >= threshold) {
      ctx.setTrait(traitKey, true);
      if (onGrantCb) onGrantCb(ctx);
      ctx.emit("corpse:trait-gained", {
        actor: ctx.actor,
        trait: traitKey,
        name: traitName,
      });
    }
  };
}
