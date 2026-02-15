import { ActiveEffects } from "../components/ActiveEffects.js";
import {
  MONSTER_PROC_EVENT_SCHEMA,
  MONSTER_PROC_TARGET,
  MONSTER_PROC_TRIGGER,
  MONSTER_STATUS_PROC_DEFS,
} from "./monsterStatusProcs.js";
import { combatSeed, mulberry32, rngInt } from "../utils/rng.js";

export const MONSTER_COMBAT_TRIGGER = MONSTER_PROC_TRIGGER;

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

const MONSTER_EXTRA_COMBAT_PROC_DEFS = Object.freeze([
  {
    id: "orc_rage_before_hit",
    monsterId: "orc",
    trigger: MONSTER_PROC_TRIGGER.ON_BEFORE_HIT,
    chancePct: 25,
    seedSalt: 0xdead0007,
    run: (ctx) => {
      ctx.damage += 2;
      ctx.emit("proc:rage", { actor: ctx.attacker, target: ctx.defender });
    },
  },
  {
    id: "skeleton_reassemble_on_damaged",
    monsterId: "skeleton",
    trigger: MONSTER_PROC_TRIGGER.ON_DAMAGED,
    chancePct: 20,
    seedSalt: 0xdead0008,
    run: (ctx) => {
      ctx.heal(ctx.defender, 2);
      ctx.emit("proc:reassemble", { actor: ctx.defender });
    },
  },
  {
    id: "troll_regenerate_on_damaged",
    monsterId: "troll",
    trigger: MONSTER_PROC_TRIGGER.ON_DAMAGED,
    chancePct: 30,
    seedSalt: 0xdead0009,
    run: (ctx) => {
      ctx.heal(ctx.defender, 1);
      ctx.emit("proc:regenerate", { actor: ctx.defender });
    },
  },
  {
    id: "wraith_touch_drain_on_hit",
    monsterId: "wraith",
    trigger: MONSTER_PROC_TRIGGER.ON_HIT,
    chancePct: 20,
    seedSalt: 0xdead0003,
    run: (ctx) => {
      const amount = Math.max(1, Math.floor(ctx.damage / 3));
      ctx.healAttacker(amount);
      ctx.emit("proc:drain", { actor: ctx.attacker, target: ctx.defender, amount });
    },
  },
  {
    id: "demon_hellfire_retaliate_on_damaged",
    monsterId: "demon",
    trigger: MONSTER_PROC_TRIGGER.ON_DAMAGED,
    chancePct: 100,
    seedSalt: 0xdead0012,
    run: (ctx) => {
      ctx.retaliate(2);
      ctx.emit("proc:hellfire", { actor: ctx.defender });
    },
  },
  {
    id: "lich_drain_on_hit",
    monsterId: "lich",
    trigger: MONSTER_PROC_TRIGGER.ON_HIT,
    chancePct: 25,
    seedSalt: 0xdead000c,
    run: (ctx) => {
      const amount = Math.max(1, Math.floor(ctx.damage / 2));
      ctx.healAttacker(amount);
      ctx.emit("proc:drain", { actor: ctx.attacker, target: ctx.defender, amount });
    },
  },
]);

export const MONSTER_COMBAT_PROC_DEFS = Object.freeze([
  ...MONSTER_STATUS_PROC_DEFS,
  ...MONSTER_EXTRA_COMBAT_PROC_DEFS,
]);

/**
 * @param {number} chancePct
 * @param {() => number} rng
 */
function rollChance(chancePct, rng) {
  if ((chancePct | 0) >= 100) return true;
  return rngInt(rng, 1, 100) <= (chancePct | 0);
}

/**
 * @param {any} def
 * @param {MonsterCombatProcContext} ctx
 */
function getProcTarget(def, ctx) {
  return def.target === MONSTER_PROC_TARGET.ATTACKER
    ? ctx.attacker
    : ctx.defender;
}

/**
 * @param {any} def
 * @param {MonsterCombatProcContext} ctx
 * @param {any} extra
 */
function buildProcEventPayload(def, ctx, extra = {}) {
  const schema = String(def?.eventSchema || MONSTER_PROC_EVENT_SCHEMA.ATTACKER_DEFENDER);
  if (schema === MONSTER_PROC_EVENT_SCHEMA.DEFENDER_ONLY) {
    return { actor: ctx.defender, ...extra };
  }
  return { actor: ctx.attacker, target: ctx.defender, ...extra };
}

/**
 * @param {any} def
 * @param {MonsterCombatProcContext} ctx
 * @param {() => number} rng
 * @param {{ degradeFloorMemory?:(rng:() => number, opts?:any) => { depth:number } } | null} deps
 */
function executeProc(def, ctx, rng, deps = null) {
  if (typeof def.run === "function") {
    def.run(ctx, rng);
  }

  if (typeof def.apply === "function") {
    def.apply({
      world: ctx.world,
      ctx: { attacker: ctx.attacker, defender: ctx.defender, damage: ctx.damage },
      rng,
      degradeFloorMemory: deps?.degradeFloorMemory,
      pushEffect: (entityId, effect) => ctx.pushEffect(entityId, effect),
      emit: (event, payload) => ctx.emit(event, payload),
      emitProc: (event, eventSchema, payload = {}) => {
        ctx.emit(event, buildProcEventPayload({ eventSchema }, ctx, payload));
      },
    });
  }

  if (def.effect && typeof def.effect === "object") {
    const targetId = getProcTarget(def, ctx);
    ctx.pushEffect(targetId, def.effect);
  }

  if (def.emitEvent) {
    ctx.emit(def.emitEvent, buildProcEventPayload(def, ctx));
  }
}

/**
 * @param {any} def
 */
function createProcRunner(def) {
  return ({ world, ctx, deps }) => {
    if (!world || !ctx) return;
    try {
      const procCtx = new MonsterCombatProcContext(world, ctx);
      const procRng = procCtx.rng(def.seedSalt | 0);
      if (!rollChance(def.chancePct, procRng)) return;
      executeProc(def, procCtx, procRng, deps || null);
    } catch {}
  };
}

/**
 * @param {any[]} defs
 */
function compileCombatHooks(defs) {
  const byMonster = new Map();

  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    const monsterId = String(def?.monsterId || "").toLowerCase();
    const trigger = String(def?.trigger || "");
    if (!monsterId || !trigger) continue;

    let hookMap = byMonster.get(monsterId);
    if (!hookMap) {
      hookMap = Object.create(null);
      byMonster.set(monsterId, hookMap);
    }

    if (!hookMap[trigger]) hookMap[trigger] = [];
    hookMap[trigger].push(createProcRunner(def));
  }

  const out = Object.create(null);
  for (const [monsterId, hookMap] of byMonster.entries()) {
    /** @type {Record<string, Function>} */
    const hooks = Object.create(null);
    for (const trigger of Object.keys(hookMap)) {
      const runners = hookMap[trigger];
      hooks[trigger] = ({ world, ctx, deps }) => {
        for (let i = 0; i < runners.length; i++) {
          runners[i]({ world, ctx, deps });
        }
      };
    }
    out[monsterId] = Object.freeze(hooks);
  }

  return Object.freeze(out);
}

export const MONSTER_COMBAT_PROCS = compileCombatHooks(MONSTER_COMBAT_PROC_DEFS);

/**
 * @param {string} monsterId
 * @returns {Record<string, Function>|null}
 */
export function getMonsterCombatHooks(monsterId) {
  return MONSTER_COMBAT_PROCS[String(monsterId || "").toLowerCase()] || null;
}
