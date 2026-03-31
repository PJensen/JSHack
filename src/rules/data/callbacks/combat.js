// rules/data/callbacks/combat.js
// Combat callback context and shared factory functions for monster combat hooks.
// Callbacks are plain (ctx) => void functions invoked via runCallbackList.

import { ActiveEffects } from "../../components/ActiveEffects.js";
import { Brain } from "../../components/Brain.js";
import { Equipment, GEAR_SLOTS } from "../../components/Equipment.js";
import { Inventory } from "../../components/Inventory.js";
import { ItemInfo } from "../../components/ItemInfo.js";
import { Material } from "../../components/Material.js";
import { NamedIdentity } from "../../components/NamedIdentity.js";
import { Player } from "../../components/Player.js";
import { Position } from "../../components/Position.js";
import { DungeonState } from "../../components/DungeonState.js";
import { degradeExplored } from "../../environment/dungeon/exploredMap.js";
import { combatSeed, createRng, mulberry32, rngInt } from "../../utils/rng.js";
import { createCombatStatFacade } from "../../utils/resolveCombatSnapshot.js";
import { createStatusFacade } from "../../utils/statusFacade.js";
import { upsertTimedEffect } from "../../utils/effectSemantics.js";
import { findNearestValidTileAround } from "../../utils/queries.js";
import { inventoryItems, addToInventory, removeFromInventory } from "../../utils/inventoryFacade.js";
import { dealDamage } from "../../utils/dealDamage.js";
import { emitSafe } from "../../utils/emitSafe.js";
import { dropLoot } from "../lootResolver.js";

// ── CombatCallbackContext ──────────────────────────────────────────

/**
 * Context passed to monster combat hook callbacks.
 * Provides roll(), pushEffect(), emit(), heal/healAttacker/retaliate
 * and cancel() for callback-list short-circuiting.
 * Also exposes deterministic stat snapshots via ctx.stats.*.
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
    this.stats = createCombatStatFacade(world, {
      attacker: () => this.attacker,
      defender: () => this.defender,
    });
    this.status = createStatusFacade(world, {
      actor: () => this.attacker,
      attacker: () => this.attacker,
      target: () => this.defender,
      defender: () => this.defender,
    });
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
    emitSafe(this.world, eventName, payload);
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
      upsertTimedEffect(ae.effects, { stacks: 1, ...effect });
      return;
    }
    try { this.world.add(entityId, ActiveEffects, { effects: [{ stacks: 1, ...effect }] }); } catch {} // ECS: may already exist
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

const DRAIN_WEAKEN_COOLDOWN_KEY = Symbol.for("jshack:combat:drainWeakenOnHit:cooldown");

/**
 * Roll -> drain attacker + apply weakened to defender, gated by per-attacker cooldown.
 * Emits optional windup when 1 turn from ready and proc event on successful siphon.
 * Intended for tactical cadence fights where players can play around proc windows.
 * @param {{
 *   chancePct?: number,
 *   seedSalt?: number,
 *   divisor?: number,
 *   cooldownTurns?: number,
 *   weakenedTurns?: number,
 *   weakenedPotency?: number,
 *   procEvent?: string,
 *   windupEvent?: string,
 * }} [opts]
 */
export function drainAndWeakenOnHit(opts = {}) {
  const chancePct = Math.max(0, Math.min(100, Number(opts.chancePct) || 30));
  const seedSalt = Number(opts.seedSalt) || 0xdead0410;
  const divisor = Math.max(1, Number(opts.divisor) || 2);
  const cooldownTurns = Math.max(0, Number(opts.cooldownTurns) || 3);
  const weakenedTurns = Math.max(1, Number(opts.weakenedTurns) || 4);
  const weakenedPotency = Math.max(1, Number(opts.weakenedPotency) || 1);
  const procEvent = String(opts.procEvent || "proc:wight:siphon");
  const windupEvent = String(opts.windupEvent || "proc:wight:windup");

  return (ctx) => {
    if (!ctx.world[DRAIN_WEAKEN_COOLDOWN_KEY]) ctx.world[DRAIN_WEAKEN_COOLDOWN_KEY] = new Map();
    const cdMap = ctx.world[DRAIN_WEAKEN_COOLDOWN_KEY];
    const attacker = ctx.attacker | 0;
    const now = ctx.world.step | 0;
    const last = Number(cdMap.get(attacker) ?? -1e9);
    const elapsed = now - last;
    if (cooldownTurns > 0 && elapsed < cooldownTurns) {
      const remaining = cooldownTurns - elapsed;
      if (remaining === 1 && windupEvent) {
        ctx.emit(windupEvent, { actor: attacker, target: ctx.defender, remaining });
      }
      return;
    }

    if (!ctx.roll(chancePct, seedSalt)) return;

    const amount = Math.max(1, Math.floor(ctx.damage / divisor));
    ctx.healAttacker(amount);
    ctx.pushEffect(ctx.defender, {
      key: "weakened",
      turnsLeft: weakenedTurns,
      potency: weakenedPotency,
      stacks: 1,
    });
    cdMap.set(attacker, now);
    if (procEvent) {
      ctx.emit(procEvent, {
        actor: attacker,
        target: ctx.defender,
        amount,
        weakenedTurns,
        weakenedPotency,
      });
    }
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
 * If defender has any matching active effect key, add flat bonus damage.
 * Used by carrion shade to prey on already-afflicted targets.
 * @param {number} bonusDmg
 * @param {string[]} effectKeys
 * @param {string} [emitEvent]
 */
export function bonusDamageIfTargetAfflicted(bonusDmg, effectKeys, emitEvent) {
  const keySet = new Set((Array.isArray(effectKeys) ? effectKeys : [])
    .map((k) => String(k || "").toLowerCase())
    .filter(Boolean));
  return (ctx) => {
    if (keySet.size === 0) return;
    const keys = Array.from(keySet.values());
    const matched = keys.some((key) => ctx.status.effectStrength(ctx.defender, key) > 0);
    if (!matched) return;
    ctx.damage += Math.max(0, Number(bonusDmg || 0));
    if (emitEvent) ctx.emit(emitEvent, { actor: ctx.attacker, target: ctx.defender });
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
 * Deal additional typed damage to defender after a successful hit.
 * Uses canonical damage pipeline and suppresses trigger recursion.
 *
 * @param {number} amount
 * @param {{
 *   type?: string,
 *   cause?: string,
 *   emitEvent?: string,
 * }} [opts]
 */
export function typedDamageOnHit(amount, opts = {}) {
  const dmg = Math.max(0, Number(amount || 0) | 0);
  const type = String(opts.type || "physical");
  const cause = String(opts.cause || `proc:${type}:hit`);
  const emitEvent = String(opts.emitEvent || "");
  return (ctx) => {
    if (!(dmg > 0)) return;
    const pos = ctx.world.get(ctx.defender, Position);
    const result = dealDamage(ctx.world, {
      target: ctx.defender,
      amount: dmg,
      source: ctx.attacker,
      type,
      cause,
      at: pos ? { x: pos.x | 0, y: pos.y | 0 } : undefined,
      noTrigger: true,
    });
    if (!result.applied) return;
    if (emitEvent) {
      ctx.emit(emitEvent, {
        actor: ctx.attacker,
        target: ctx.defender,
        amount: result.amount | 0,
        type,
      });
    }
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
 * Roll → heal damaged entity by incoming damage, apply brief invulnerability,
 * emit phase event, and cancel remaining onDamaged callbacks.
 * @param {number} chancePct
 * @param {number} seedSalt
 * @param {string} [emitEvent]
 */
export function phaseOutOnDamaged(chancePct, seedSalt, emitEvent = "proc:phased") {
  return (ctx) => {
    if (!ctx.roll(chancePct, seedSalt)) return;
    const healAmount = Math.max(0, Math.floor(Number(ctx.damage || 0)));
    if (healAmount > 0) ctx.heal(ctx.defender, healAmount);
    ctx.pushEffect(ctx.defender, { key: "invulnerable", turnsLeft: 1, potency: 1, stacks: 1 });
    if (emitEvent) ctx.emit(emitEvent, { actor: ctx.defender, attacker: ctx.attacker, amount: healAmount });
    ctx.cancel("PHASE_OUT");
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

// ── Corrode equipment (rust monster) ────────────────────────────────

/** Slots eligible for corrosion (metal gear). */
const CORRODE_SLOTS = ["weapon", "armor", "head", "gloves", "feet", "legs", "offhand"];

/** Max corrosion stacks per item. */
const MAX_CORROSION_STACKS = 3;

/**
 * Roll → pick a random metal-eligible equipped slot on the defender →
 * decrement its primary stat bonus and track corrosion stacks.
 * At max stacks the item name is prefixed with "Corroded".
 * @param {number} chancePct
 * @param {number} seedSalt
 */
export function corrodeEquipmentOnHit(chancePct, seedSalt) {
  return (ctx) => {
    if (!ctx.roll(chancePct, seedSalt)) return;

    const equip = ctx.world.get(ctx.defender, Equipment);
    if (!equip) return;

    // Gather equipped items in corrode-eligible slots
    const rng = ctx.rng(seedSalt + 1);
    const candidates = [];
    for (const slot of CORRODE_SLOTS) {
      const itemId = equip[slot];
      if (!(itemId > 0) || !ctx.world.isAlive(itemId)) continue;
      const info = ctx.world.get(itemId, ItemInfo);
      if (!info) continue;
      // Skip items with no bonuses at all (natural/bare)
      if (!info.bonuses || typeof info.bonuses !== 'object') continue;
      // Skip corrosion-resistant materials (stainless steel, mithril, etc.)
      const mat = ctx.world.get(itemId, Material);
      if (mat && typeof mat.corrosionResist === 'number' && mat.corrosionResist >= 0.95) continue;
      const stacks = Number(info.corrosionStacks || 0) | 0;
      if (stacks >= MAX_CORROSION_STACKS) continue;
      candidates.push({ slot, itemId, info });
    }
    if (candidates.length === 0) return;

    // Pick one at random
    const pick = candidates[rngInt(rng, 0, candidates.length - 1)];
    const { itemId, info } = pick;

    // Increment corrosion stacks
    const newStacks = (Number(info.corrosionStacks || 0) | 0) + 1;
    info.corrosionStacks = newStacks;

    // Apply stat penalty: reduce the largest positive bonus by 1
    const bonuses = info.bonuses;
    let bestKey = null;
    let bestVal = 0;
    for (const [k, v] of Object.entries(bonuses)) {
      if (typeof v === 'number' && v > bestVal) { bestKey = k; bestVal = v; }
    }
    if (bestKey) bonuses[bestKey] = Math.max(0, bonuses[bestKey] - 1);

    // At max stacks, prefix the item name
    if (newStacks >= MAX_CORROSION_STACKS) {
      const ni = ctx.world.get(itemId, NamedIdentity);
      if (ni && ni.name && !ni.name.startsWith('Corroded ')) {
        ni.name = `Corroded ${ni.name}`;
      }
    }

    const ni = ctx.world.get(itemId, NamedIdentity);
    const itemName = ni?.name || 'equipment';
    ctx.emit("proc:corroded", {
      actor: ctx.attacker,
      target: ctx.defender,
      itemId,
      itemName,
      stacks: newStacks,
    });
  };
}

// ── Steal and blink (nymph) ─────────────────────────────────────────

const STEAL_COOLDOWN_KEY = Symbol.for("jshack:ai:stealAndBlink:cooldown");

/**
 * On hit: steal a random item from the defender's inventory or equipment,
 * then blink the attacker away. Used by nymphs.
 * @param {{ chancePct?: number, seedSalt?: number, cooldownTurns?: number, blinkDistance?: number }} [opts]
 */
export function stealAndBlinkOnHit(opts = {}) {
  const chancePct = Math.max(0, Math.min(100, Number(opts.chancePct) || 50));
  const seedSalt = Number(opts.seedSalt) || 0xdead0030;
  const cooldownTurns = Math.max(0, Number(opts.cooldownTurns) || 8);
  const blinkDistance = Math.max(3, Number(opts.blinkDistance) || 10);

  return (ctx) => {
    if (!ctx.roll(chancePct, seedSalt)) return;

    // Only steal from players
    if (!ctx.world.has(ctx.defender, Player)) return;

    // Per-attacker cooldown
    if (!ctx.world[STEAL_COOLDOWN_KEY]) ctx.world[STEAL_COOLDOWN_KEY] = new Map();
    const cdMap = ctx.world[STEAL_COOLDOWN_KEY];
    const lastUsed = cdMap.get(ctx.attacker | 0) || 0;
    if (((ctx.world.step | 0) - lastUsed) < cooldownTurns) return;

    const rng = ctx.rng(seedSalt + 1);

    // Build candidate list: non-weapon equipped items + inventory items
    const equip = ctx.world.get(ctx.defender, Equipment);
    const candidates = [];
    if (equip) {
      for (const slot of GEAR_SLOTS) {
        if (slot === 'weapon') continue; // don't steal the weapon from their hands
        const itemId = equip[slot];
        if (!(itemId > 0) || !ctx.world.isAlive(itemId)) continue;
        candidates.push({ itemId, source: 'equip', slot });
      }
    }
    for (const itemId of inventoryItems(ctx.world, ctx.defender)) {
      if (!ctx.world.isAlive(itemId)) continue;
      candidates.push({ itemId, source: 'inventory', slot: null });
    }
    if (candidates.length === 0) return;

    // Pick random item
    const pick = candidates[rngInt(rng, 0, candidates.length - 1)];

    // Remove from defender
    if (pick.source === 'equip' && equip) {
      equip[pick.slot] = null;
    } else {
      removeFromInventory(ctx.world, ctx.defender, pick.itemId);
    }

    // Add to attacker inventory (nymph carries it)
    if (ctx.world.has(ctx.attacker, Inventory)) {
      addToInventory(ctx.world, ctx.attacker, pick.itemId);
    }

    cdMap.set(ctx.attacker | 0, ctx.world.step | 0);

    const stolenNi = ctx.world.get(pick.itemId, NamedIdentity);
    const itemName = stolenNi?.name || 'item';
    const defPos = ctx.world.get(ctx.defender, Position);
    ctx.emit("nymph:stole", {
      actor: ctx.attacker,
      target: ctx.defender,
      itemId: pick.itemId,
      itemName,
      at: defPos ? { x: defPos.x | 0, y: defPos.y | 0 } : null,
    });

    // Blink away
    const atkPos = ctx.world.get(ctx.attacker, Position);
    if (atkPos) {
      const exclude = [
        { x: atkPos.x | 0, y: atkPos.y | 0 },
      ];
      if (defPos) exclude.push({ x: defPos.x | 0, y: defPos.y | 0 });
      const landing = findNearestValidTileAround(ctx.world, atkPos, { maxDistance: blinkDistance, exclude, preferFar: true });
      if (landing) {
        const from = { x: atkPos.x | 0, y: atkPos.y | 0 };
        ctx.world.set(ctx.attacker, Position, { x: landing.x | 0, y: landing.y | 0 });
        ctx.emit("nymph:blinked", {
          actor: ctx.attacker,
          from,
          to: { x: landing.x | 0, y: landing.y | 0 },
        });
      }
    }
  };
}

const LOOT_GOBLIN_SPILL_STATE_KEY = Symbol.for("jshack:combat:lootGoblinSpill:state");

function currentDepth(world) {
  for (const [, ds] of world.query(DungeonState)) {
    return Math.max(1, Number(ds?.currentDepth || 1) | 0);
  }
  return 1;
}

/**
 * On damaged: spill loot at current tile and optionally short-blink.
 * Intended for loot goblins.
 *
 * @param {{
 *   dropTable?: string,
 *   dropChancePct?: number,
 *   dropCooldownTurns?: number,
 *   blinkChancePct?: number,
 *   blinkCooldownTurns?: number,
 *   blinkDistance?: number,
 *   seedSalt?: number,
 * }} [opts]
 */
export function spillLootAndShortBlinkOnDamaged(opts = {}) {
  const dropTable = String(opts.dropTable || "hit:loot_goblin");
  const dropChancePct = Math.max(0, Math.min(100, Number(opts.dropChancePct) || 100));
  const dropCooldownTurns = Math.max(0, Number(opts.dropCooldownTurns) || 0);
  const blinkChancePct = Math.max(0, Math.min(100, Number(opts.blinkChancePct) || 55));
  const blinkCooldownTurns = Math.max(0, Number(opts.blinkCooldownTurns) || 2);
  const blinkDistance = Math.max(1, Number(opts.blinkDistance) || 4);
  const seedSalt = Number(opts.seedSalt) || 0xdead00b0;

  return (ctx) => {
    const defender = ctx.defender | 0;
    if (!(defender > 0) || !ctx.world.isAlive(defender)) return;

    if (!ctx.world[LOOT_GOBLIN_SPILL_STATE_KEY]) ctx.world[LOOT_GOBLIN_SPILL_STATE_KEY] = new Map();
    const state = ctx.world[LOOT_GOBLIN_SPILL_STATE_KEY];
    const now = Number(ctx.world.step || 0) | 0;
    const rec = state.get(defender) || { dropTurn: -1e9, blinkTurn: -1e9 };

    const pos = ctx.world.get(defender, Position);
    if (!pos) return;
    const at = { x: pos.x | 0, y: pos.y | 0 };

    if ((now - rec.dropTurn) >= dropCooldownTurns && ctx.roll(dropChancePct, seedSalt)) {
      const lootSeed = combatSeed(ctx.world.seed, now, ctx.attacker, defender, seedSalt ^ 0x51f15e);
      const rng = createRng(lootSeed >>> 0);
      dropLoot(ctx.world, dropTable, rng, currentDepth(ctx.world), at);
      rec.dropTurn = now;
      ctx.emit("loot_goblin:spilled", { id: defender, at });
    }

    if ((now - rec.blinkTurn) >= blinkCooldownTurns && ctx.roll(blinkChancePct, seedSalt + 1)) {
      const attackerPos = ctx.world.get(ctx.attacker, Position);
      const exclude = [{ x: at.x, y: at.y }];
      if (attackerPos) exclude.push({ x: attackerPos.x | 0, y: attackerPos.y | 0 });

      const landing = findNearestValidTileAround(ctx.world, at, { maxDistance: blinkDistance, exclude });
      if (landing && ((landing.x | 0) !== at.x || (landing.y | 0) !== at.y)) {
        ctx.world.set(defender, Position, { x: landing.x | 0, y: landing.y | 0 });
        rec.blinkTurn = now;
        ctx.emit("loot_goblin:blinked", {
          id: defender,
          from: at,
          to: { x: landing.x | 0, y: landing.y | 0 },
        });
      }
    }

    state.set(defender, rec);
  };
}
