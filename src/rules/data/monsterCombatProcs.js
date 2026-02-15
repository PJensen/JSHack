import { ActiveEffects } from "../components/ActiveEffects.js";
import { Brain } from "../components/Brain.js";
import { degradeFloorMemory } from "../environment/dungeon/transition.js";
import { combatSeed, mulberry32, rngInt } from "../utils/rng.js";

export const MONSTER_COMBAT_TRIGGER = Object.freeze({
  BEFORE_HIT: "onBeforeHit",
  HIT: "onHit",
  DAMAGED: "onDamaged",
});

/**
 * @typedef {{
 *   attacker:number,
 *   defender:number,
 *   damage:number,
 *   heal?:(entity:number, amount:number) => void,
 *   healAttacker?:(amount:number) => void,
 *   retaliate?:(amount:number) => void,
 * }} CombatProcFrame
 */

export class MonsterCombatProcContext {
  /**
   * @param {any} world
   * @param {CombatProcFrame} frame
   */
  constructor(world, frame) {
    this.world = world;
    this.frame = frame;
  }

  get attacker() { return this.frame.attacker | 0; }
  get defender() { return this.frame.defender | 0; }
  get damage() { return Number(this.frame.damage || 0); }
  set damage(value) { this.frame.damage = Math.max(0, Number(value || 0)); }

  /**
   * @param {number} chancePct
   * @param {number} seedSalt
   */
  roll(chancePct, seedSalt) {
    if ((chancePct | 0) >= 100) return true;
    const r = mulberry32(combatSeed(this.world.seed, this.world.step, this.attacker, this.defender, seedSalt));
    return rngInt(r, 1, 100) <= chancePct;
  }

  /**
   * @param {number} seedSalt
   */
  rng(seedSalt) {
    return mulberry32(combatSeed(this.world.seed, this.world.step, this.attacker, this.defender, seedSalt));
  }

  /**
   * @param {string} eventName
   * @param {any} payload
   */
  emit(eventName, payload) {
    try { this.world.emit(eventName, payload); } catch {}
  }

  /**
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

  /**
   * @param {number} entityId
   * @param {number} amount
   */
  heal(entityId, amount) {
    if (typeof this.frame.heal === "function") {
      this.frame.heal(entityId, amount);
      return;
    }
  }

  /**
   * @param {number} amount
   */
  healAttacker(amount) {
    if (typeof this.frame.healAttacker === "function") {
      this.frame.healAttacker(amount);
      return;
    }
    this.heal(this.attacker, amount);
  }

  /**
   * @param {number} amount
   */
  retaliate(amount) {
    if (typeof this.frame.retaliate === "function") this.frame.retaliate(amount);
  }
}

/**
 * @param {(ctx: MonsterCombatProcContext) => void} fn
 */
function wrap(fn) {
  return ({ world, ctx }) => {
    if (!world || !ctx) return;
    try { fn(new MonsterCombatProcContext(world, ctx)); } catch {}
  };
}

export const MONSTER_COMBAT_PROCS = Object.freeze({
  rat: Object.freeze({
    [MONSTER_COMBAT_TRIGGER.HIT]: wrap((ctx) => {
      if (!ctx.roll(25, 0xdead0001)) return;
      ctx.pushEffect(ctx.defender, { key: "disease", turnsLeft: 20, potency: 1, stacks: 1 });
      ctx.emit("proc:diseased", { actor: ctx.attacker, target: ctx.defender });
    }),
  }),
  goblin: Object.freeze({
    [MONSTER_COMBAT_TRIGGER.HIT]: wrap((ctx) => {
      if (!ctx.roll(20, 0xdead0005)) return;
      ctx.pushEffect(ctx.defender, { key: "bleed", turnsLeft: 3, potency: 1, stacks: 1 });
      ctx.emit("proc:bleeding", { actor: ctx.attacker, target: ctx.defender });
    }),
  }),
  bat: Object.freeze({
    [MONSTER_COMBAT_TRIGGER.HIT]: wrap((ctx) => {
      if (!ctx.roll(15, 0xdead0006)) return;
      ctx.pushEffect(ctx.defender, { key: "stun", turnsLeft: 1, potency: 1, stacks: 1 });
      ctx.emit("proc:stunned", { actor: ctx.attacker, target: ctx.defender });
    }),
  }),
  grid_bug: Object.freeze({
    [MONSTER_COMBAT_TRIGGER.HIT]: wrap((ctx) => {
      if (!ctx.roll(30, 0xdead0010)) return;
      ctx.pushEffect(ctx.defender, { key: "shock", turnsLeft: 2, potency: 1, stacks: 1 });
      ctx.emit("proc:shocked", { actor: ctx.attacker, target: ctx.defender });
    }),
  }),
  snake: Object.freeze({
    [MONSTER_COMBAT_TRIGGER.HIT]: wrap((ctx) => {
      if (!ctx.roll(25, 0xdead000f)) return;
      ctx.pushEffect(ctx.defender, { key: "poison", turnsLeft: 5, potency: 1, stacks: 1 });
      ctx.emit("proc:poisoned", { actor: ctx.attacker, target: ctx.defender });
    }),
  }),
  orc: Object.freeze({
    [MONSTER_COMBAT_TRIGGER.BEFORE_HIT]: wrap((ctx) => {
      if (!ctx.roll(25, 0xdead0007)) return;
      ctx.damage += 2;
      ctx.emit("proc:rage", { actor: ctx.attacker, target: ctx.defender });
    }),
  }),
  skeleton: Object.freeze({
    [MONSTER_COMBAT_TRIGGER.DAMAGED]: wrap((ctx) => {
      if (!ctx.roll(20, 0xdead0008)) return;
      ctx.heal(ctx.defender, 2);
      ctx.emit("proc:reassemble", { actor: ctx.defender });
    }),
  }),
  spider: Object.freeze({
    [MONSTER_COMBAT_TRIGGER.HIT]: wrap((ctx) => {
      if (!ctx.roll(30, 0xdead0002)) return;
      ctx.pushEffect(ctx.defender, { key: "poison", turnsLeft: 5, potency: 2, stacks: 1 });
      ctx.emit("proc:poisoned", { actor: ctx.attacker, target: ctx.defender });
    }),
  }),
  troll: Object.freeze({
    [MONSTER_COMBAT_TRIGGER.HIT]: wrap((ctx) => {
      ctx.pushEffect(ctx.attacker, { key: "regen", turnsLeft: 3, potency: 2, stacks: 1 });
    }),
    [MONSTER_COMBAT_TRIGGER.DAMAGED]: wrap((ctx) => {
      if (!ctx.roll(30, 0xdead0009)) return;
      ctx.heal(ctx.defender, 1);
      ctx.emit("proc:regenerate", { actor: ctx.defender });
    }),
  }),
  wraith: Object.freeze({
    [MONSTER_COMBAT_TRIGGER.HIT]: wrap((ctx) => {
      if (!ctx.roll(20, 0xdead0003)) return;
      const amount = Math.max(1, Math.floor(ctx.damage / 3));
      ctx.healAttacker(amount);
      ctx.emit("proc:drain", { actor: ctx.attacker, target: ctx.defender, amount });
    }),
  }),
  ogre: Object.freeze({
    [MONSTER_COMBAT_TRIGGER.HIT]: wrap((ctx) => {
      if (!ctx.roll(25, 0xdead000a)) return;
      ctx.pushEffect(ctx.defender, { key: "stun", turnsLeft: 2, potency: 1, stacks: 1 });
      ctx.emit("proc:stunned", { actor: ctx.attacker, target: ctx.defender });
    }),
  }),
  floating_eye: Object.freeze({
    [MONSTER_COMBAT_TRIGGER.HIT]: wrap((ctx) => {
      const r = ctx.rng(0xdead000e);
      if (rngInt(r, 1, 100) > 20) return;
      const { depth } = degradeFloorMemory(r, { fraction: 0.3 });
      const brain = ctx.world.get(ctx.defender, Brain);
      if (brain) brain.learnedSpellIds = [];
      ctx.pushEffect(ctx.defender, { key: "mindwipe", turnsLeft: 2, potency: 1, stacks: 1 });
      ctx.emit("proc:mindwipe", { actor: ctx.attacker, target: ctx.defender, affectedDepth: depth });
    }),
  }),
  demon: Object.freeze({
    [MONSTER_COMBAT_TRIGGER.HIT]: wrap((ctx) => {
      if (!ctx.roll(30, 0xdead000b)) return;
      ctx.pushEffect(ctx.defender, { key: "burn", turnsLeft: 4, potency: 3, stacks: 1 });
      ctx.emit("proc:burning", { actor: ctx.attacker, target: ctx.defender });
    }),
    [MONSTER_COMBAT_TRIGGER.DAMAGED]: wrap((ctx) => {
      ctx.retaliate(2);
      ctx.emit("proc:hellfire", { actor: ctx.defender });
    }),
  }),
  dragon: Object.freeze({
    [MONSTER_COMBAT_TRIGGER.HIT]: wrap((ctx) => {
      if (!ctx.roll(20, 0xdead0004)) return;
      ctx.pushEffect(ctx.defender, { key: "burn", turnsLeft: 5, potency: 4, stacks: 1 });
      ctx.emit("proc:burning", { actor: ctx.attacker, target: ctx.defender });
    }),
  }),
  lich: Object.freeze({
    [MONSTER_COMBAT_TRIGGER.HIT]: wrap((ctx) => {
      if (!ctx.roll(25, 0xdead000c)) return;
      const amount = Math.max(1, Math.floor(ctx.damage / 2));
      ctx.healAttacker(amount);
      ctx.emit("proc:drain", { actor: ctx.attacker, target: ctx.defender, amount });
    }),
    [MONSTER_COMBAT_TRIGGER.DAMAGED]: wrap((ctx) => {
      if (!ctx.roll(20, 0xdead000d)) return;
      ctx.pushEffect(ctx.defender, { key: "regen", turnsLeft: 3, potency: 2, stacks: 1 });
      ctx.emit("proc:phylactery", { actor: ctx.defender });
    }),
  }),
});

/**
 * @param {string} monsterId
 * @returns {Record<string, Function>|null}
 */
export function getMonsterCombatHooks(monsterId) {
  return MONSTER_COMBAT_PROCS[String(monsterId || "").toLowerCase()] || null;
}

