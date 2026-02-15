// rules/data/callbacks/combat.js
// Combat callback context and shared factory functions for monster combat hooks.
// Callbacks are plain (ctx) => void functions invoked via runCallbackList.

import { ActiveEffects } from "../../components/ActiveEffects.js";
import { Brain } from "../../components/Brain.js";
import { degradeExplored } from "../../environment/dungeon/exploredMap.js";
import { combatSeed, mulberry32, rngInt } from "../../utils/rng.js";

// ── CombatCallbackContext ──────────────────────────────────────────

/**
 * Context passed to monster combat hook callbacks.
 * Provides roll(), pushEffect(), emit(), heal/healAttacker/retaliate
 * and cancel() for callback-list short-circuiting.
 */
export class CombatCallbackContext {
  /**
   * @param {any} world
   * @param {{
   *   attacker: number,
   *   defender: number,
   *   damage: number,
   *   heal?: (entity:number, amount:number) => void,
   *   healAttacker?: (amount:number) => void,
   *   retaliate?: (amount:number) => void,
   * }} frame
   * @param {{ degradeFloorMemory?: Function } | null} [deps]
   */
  constructor(world, frame, deps = null) {
    this.world = world;
    this._frame = frame;
    this._cancelled = false;
    this._cancelReason = null;
    this.deps = deps;
  }

  get attacker() { return this._frame.attacker | 0; }
  get defender() { return this._frame.defender | 0; }
  get damage() { return Number(this._frame.damage || 0); }
  set damage(value) { this._frame.damage = Math.max(0, Number(value || 0)); }

  get cancelled() { return this._cancelled; }
  get cancelReason() { return this._cancelReason; }

  cancel(reason) {
    this._cancelled = true;
    this._cancelReason = typeof reason === "string"
      ? { code: reason, message: reason }
      : reason || { code: "CANCELLED", message: "Cancelled" };
  }

  /**
   * @param {number} chancePct
   * @param {number} seedSalt
   */
  roll(chancePct, seedSalt) {
    if ((chancePct | 0) >= 100) return true;
    const r = mulberry32(combatSeed(this.world.seed, this.world.step, this.attacker, this.defender, seedSalt));
    return rngInt(r, 1, 100) <= chancePct;
  }

  /** @param {number} seedSalt */
  rng(seedSalt) {
    return mulberry32(combatSeed(this.world.seed, this.world.step, this.attacker, this.defender, seedSalt));
  }

  /** @param {string} eventName @param {any} payload */
  emit(eventName, payload) {
    try { this.world.emit && this.world.emit(eventName, payload); } catch {}
  }

  /**
   * Push a status effect onto an entity (immediate, not queued).
   * Stacks with existing effects of the same key.
   * @param {number} entityId
   * @param {{ key:string, turnsLeft:number, potency:number, stacks?:number }} effect
   */
  pushEffect(entityId, effect) {
    const ae = this.world.get(entityId, ActiveEffects);
    if (ae && Array.isArray(ae.effects)) {
      const existing = ae.effects.find((e) => e.key === effect.key);
      if (existing) {
        existing.stacks = (existing.stacks || 1) + 1;
        existing.turnsLeft = Math.max(existing.turnsLeft, effect.turnsLeft);
        return;
      }
      ae.effects.push({ stacks: 1, ...effect });
      return;
    }
    try { this.world.add(entityId, ActiveEffects, { effects: [{ stacks: 1, ...effect }] }); } catch {}
  }

  /** @param {number} entityId @param {number} amount */
  heal(entityId, amount) {
    if (typeof this._frame.heal === "function") {
      this._frame.heal(entityId, amount);
    }
  }

  /** @param {number} amount */
  healAttacker(amount) {
    if (typeof this._frame.healAttacker === "function") {
      this._frame.healAttacker(amount);
      return;
    }
    this.heal(this.attacker, amount);
  }

  /** @param {number} amount */
  retaliate(amount) {
    if (typeof this._frame.retaliate === "function") this._frame.retaliate(amount);
  }
}

// ── Factory functions for common combat callback patterns ──────────

/**
 * Roll → push status effect on defender → emit event.
 * Used by rat (disease), spider (poison), dragon (burn), etc.
 */
export function statusEffectOnHit(chancePct, seedSalt, effect, emitEvent) {
  return (ctx) => {
    if (!ctx.roll(chancePct, seedSalt)) return;
    ctx.pushEffect(ctx.defender, { stacks: 1, ...effect });
    if (emitEvent) ctx.emit(emitEvent, { actor: ctx.attacker, target: ctx.defender });
  };
}

/**
 * Push self-buff effect on attacker (always fires, no roll).
 * Used by troll (regen on hit).
 */
export function selfBuffOnHit(effect) {
  return (ctx) => {
    ctx.pushEffect(ctx.attacker, { stacks: 1, ...effect });
  };
}

/**
 * Roll → heal attacker by fraction of damage dealt → emit drain event.
 * Used by wraith (damage/3), lich (damage/2).
 */
export function drainOnHit(chancePct, seedSalt, divisor) {
  return (ctx) => {
    if (!ctx.roll(chancePct, seedSalt)) return;
    const amount = Math.max(1, Math.floor(ctx.damage / divisor));
    ctx.healAttacker(amount);
    ctx.emit("proc:drain", { actor: ctx.attacker, target: ctx.defender, amount });
  };
}

/**
 * Roll → increase damage → emit event.
 * Used by orc (rage).
 */
export function bonusDamageOnBeforeHit(chancePct, seedSalt, bonusDmg, emitEvent) {
  return (ctx) => {
    if (!ctx.roll(chancePct, seedSalt)) return;
    ctx.damage += bonusDmg;
    ctx.emit(emitEvent, { actor: ctx.attacker, target: ctx.defender });
  };
}

/**
 * Roll → heal the damaged entity → emit event.
 * Used by skeleton (reassemble), troll (regenerate).
 */
export function healOnDamaged(chancePct, seedSalt, amount, emitEvent) {
  return (ctx) => {
    if (!ctx.roll(chancePct, seedSalt)) return;
    ctx.heal(ctx.defender, amount);
    ctx.emit(emitEvent, { actor: ctx.defender });
  };
}

/**
 * Retaliate damage back to attacker → emit event (always fires).
 * Used by demon (hellfire).
 */
export function retaliateOnDamaged(amount, emitEvent) {
  return (ctx) => {
    ctx.retaliate(amount);
    ctx.emit(emitEvent, { actor: ctx.defender });
  };
}

/**
 * Roll → push status effect on the damaged entity (self) → emit event.
 * Used by lich (phylactery regen).
 * @param {boolean} [defenderOnly] - if true, emit payload has only { actor: defender }
 */
export function statusEffectOnDamaged(chancePct, seedSalt, effect, emitEvent, defenderOnly = false) {
  return (ctx) => {
    if (!ctx.roll(chancePct, seedSalt)) return;
    ctx.pushEffect(ctx.defender, { stacks: 1, ...effect });
    if (emitEvent) {
      const payload = defenderOnly
        ? { actor: ctx.defender }
        : { actor: ctx.attacker, target: ctx.defender };
      ctx.emit(emitEvent, payload);
    }
  };
}

/**
 * Mindflayer blast: roll → clear spells, degrade map memory, push mindwipe.
 * Unique to floating eye / mindflayer.
 */
export function mindflayerBlastOnHit(chancePct, seedSalt) {
  return (ctx) => {
    if (!ctx.roll(chancePct, seedSalt)) return;
    const rng = ctx.rng(seedSalt + 1);
    const degradeMemory = typeof ctx.deps?.degradeFloorMemory === "function"
      ? ctx.deps.degradeFloorMemory
      : (rngFn, opts = {}) => {
          const fraction = Math.max(0, Math.min(1, opts?.fraction ?? 0.3));
          degradeExplored(fraction, rngFn);
          return { depth: 0 };
        };
    const { depth } = degradeMemory(rng, { fraction: 0.3 });
    const brain = ctx.world.get(ctx.defender, Brain);
    if (brain) brain.learnedSpellIds = [];
    ctx.pushEffect(ctx.defender, { key: "mindwipe", turnsLeft: 2, potency: 1, stacks: 1 });
    ctx.emit("proc:mindwipe", { actor: ctx.attacker, target: ctx.defender, affectedDepth: depth });
  };
}
