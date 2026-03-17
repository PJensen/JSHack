import { HUNGER_COMBAT_LEVELS } from "../data/hungerCombatLevels.js";
import { resolveResistance } from "./dealDamage.js";
import { resolveCanonicalStats } from "./canonicalStats.js";
import { statusStrength } from "./statusFacade.js";

const MODE_RULES = Object.freeze({
  melee: Object.freeze({
    includeAttackStatuses: true,
    includeDefenseStatuses: true,
    includeStoneskin: true,
    clampAttackAtZero: true,
    clampDefenseAtZero: true,
  }),
  ranged: Object.freeze({
    includeAttackStatuses: false,
    includeDefenseStatuses: false,
    includeStoneskin: true,
    clampAttackAtZero: false,
    clampDefenseAtZero: false,
  }),
});

/**
 * @param {string} mode
 */
function getModeRules(mode) {
  const normalized = String(mode || "melee").toLowerCase();
  return MODE_RULES[normalized] || MODE_RULES.melee;
}

/**
 * @param {Array<{stat:'attack'|'defense', source:string, value:number, reason:string}>} modifiers
 * @param {'attack'|'defense'} stat
 * @param {string} source
 * @param {number} value
 * @param {string} reason
 */
function pushModifier(modifiers, stat, source, value, reason) {
  if (!Number.isFinite(value) || value === 0) return;
  modifiers.push({ stat, source, value, reason });
}

/**
 * Resolve deterministic to-hit/defense stats for one combatant.
 * This is the canonical stat pipeline consumed by melee/ranged hit systems.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} entityId
 * @param {{ mode?: 'melee' | 'ranged' | string }} [context]
 */
export function resolveCombatSnapshot(world, entityId, context = {}) {
  const id = Number(entityId || 0) | 0;
  const mode = String(context.mode || "melee").toLowerCase();
  const rules = getModeRules(mode);

  const resolvedStats = resolveCanonicalStats(world, id);

  const accuracy = Number(resolvedStats?.accuracy || 0);
  const damagePower = Number(resolvedStats?.damagePower || 0);
  const evade = Number(resolvedStats?.evade || 0);
  const luck = Number(resolvedStats?.luck || 0) + statusStrength(world, id, "lucky");
  const critChance = Number(resolvedStats?.critChancePhysical || 0);
  const critMult = Number(resolvedStats?.critMultPhysical || 0);

  let hunger = 0;
  for (let i = 0; i < HUNGER_COMBAT_LEVELS.length; i++) {
    hunger = Math.max(hunger, statusStrength(world, id, HUNGER_COMBAT_LEVELS[i]));
  }

  const statusTotals = {
    disease: statusStrength(world, id, "disease"),
    hunger,
    weakened: statusStrength(world, id, "weakened"),
    cursed: statusStrength(world, id, "cursed"),
    blessed: statusStrength(world, id, "blessed"),
    stoneskin: statusStrength(world, id, "stoneskin"),
    berserk: statusStrength(world, id, "berserk"),
  };

  /** @type {Array<{stat:'attack'|'defense', source:string, value:number, reason:string}>} */
  const modifiers = [];

  let attackBonus = 1 + accuracy;
  pushModifier(modifiers, "attack", "base", 1, "base-to-hit");
  pushModifier(modifiers, "attack", "resolved:accuracy", accuracy, "resolved-accuracy");

  if (rules.includeAttackStatuses) {
    pushModifier(modifiers, "attack", "status:disease", -statusTotals.disease, "disease-penalty");
    pushModifier(modifiers, "attack", "status:hunger", -statusTotals.hunger, "hunger-penalty");
    pushModifier(modifiers, "attack", "status:weakened", -statusTotals.weakened, "weakened-penalty");
    pushModifier(modifiers, "attack", "status:cursed", -statusTotals.cursed, "cursed-penalty");
    pushModifier(modifiers, "attack", "status:blessed", statusTotals.blessed, "blessed-bonus");
    pushModifier(modifiers, "attack", "status:berserk", statusTotals.berserk > 0 ? 3 : 0, "berserk-bonus");

    attackBonus += (
      -statusTotals.disease
      -statusTotals.hunger
      -statusTotals.weakened
      -statusTotals.cursed
      +statusTotals.blessed
      +(statusTotals.berserk > 0 ? 3 : 0)
    );
  }

  if (rules.clampAttackAtZero && attackBonus < 0) {
    pushModifier(modifiers, "attack", "rule:attackFloor", -attackBonus, "min-zero");
    attackBonus = 0;
  }

  let defenseContribution = evade;
  pushModifier(modifiers, "defense", "base", 10, "base-armor-class");
  pushModifier(modifiers, "defense", "resolved:evade", evade, "resolved-evade");

  if (rules.includeDefenseStatuses) {
    pushModifier(modifiers, "defense", "status:disease", -statusTotals.disease, "disease-penalty");
    pushModifier(modifiers, "defense", "status:hunger", -statusTotals.hunger, "hunger-penalty");
    pushModifier(modifiers, "defense", "status:weakened", -statusTotals.weakened, "weakened-penalty");
    pushModifier(modifiers, "defense", "status:cursed", -statusTotals.cursed, "cursed-penalty");
    pushModifier(modifiers, "defense", "status:blessed", statusTotals.blessed, "blessed-bonus");

    defenseContribution += (
      -statusTotals.disease
      -statusTotals.hunger
      -statusTotals.weakened
      -statusTotals.cursed
      +statusTotals.blessed
    );
  }

  if (rules.includeStoneskin) {
    pushModifier(modifiers, "defense", "status:stoneskin", statusTotals.stoneskin, "stoneskin-bonus");
    defenseContribution += statusTotals.stoneskin;
  }

  if (rules.clampDefenseAtZero && defenseContribution < 0) {
    pushModifier(modifiers, "defense", "rule:defenseFloor", -defenseContribution, "min-zero");
    defenseContribution = 0;
  }

  return {
    entityId: id,
    mode,
    attackBonus,
    armorClass: 10 + defenseContribution,
    damageFlatBonus: Math.max(0, Math.floor(damagePower / 2)),
    damageMult: statusTotals.berserk > 0 ? 1.5 : 1,
    accuracy,
    damagePower,
    evade,
    mitigation: Number(resolvedStats?.mitigation || 0),
    luck,
    critChance,
    critMult,
    status: Object.freeze({ ...statusTotals }),
    modifiers: Object.freeze(modifiers),
  };
}

/**
 * Create a callback-friendly stat accessor facade over resolveCombatSnapshot().
 * Provides deterministic snapshots and simple scalar lookups for data callbacks.
 *
 * @param {{ get:(id:number, Comp:any)=>any, isAlive:(id:number)=>boolean }} world
 * @param {{
 *   actor?: () => number,
 *   primary?: () => number,
 *   target?: () => number,
 *   attacker?: () => number,
 *   defender?: () => number,
 * }} [anchors]
 */
export function createCombatStatFacade(world, anchors = {}) {
  const cache = new Map();

  /**
   * @param {number} entityId
   * @param {string} mode
   * @returns {string}
   */
  function cacheKey(entityId, mode) {
    return `${String(mode || "melee").toLowerCase()}:${entityId | 0}`;
  }

  /**
   * @param {number} entityId
   */
  function validEntity(entityId) {
    const id = Number(entityId || 0) | 0;
    return id > 0 && !!world?.isAlive?.(id);
  }

  /**
   * @param {number} entityId
   * @param {string} [mode]
   * @returns {ReturnType<typeof resolveCombatSnapshot>|null}
   */
  function snapshot(entityId, mode = "melee") {
    const id = Number(entityId || 0) | 0;
    if (!validEntity(id)) return null;
    const k = cacheKey(id, mode);
    const existing = cache.get(k);
    if (existing) return existing;
    const next = resolveCombatSnapshot(world, id, { mode: String(mode || "melee") });
    cache.set(k, next);
    return next;
  }

  /**
   * @param {"actor"|"primary"|"target"|"attacker"|"defender"} name
   * @param {string} [mode]
   * @returns {ReturnType<typeof resolveCombatSnapshot>|null}
   */
  function snapshotFromAnchor(name, mode = "melee") {
    const read = anchors[name];
    if (typeof read !== "function") return null;
    return snapshot(read(), mode);
  }

  /**
   * @param {number} entityId
   * @param {string} key
   * @param {string} [mode]
   */
  function value(entityId, key, mode = "melee") {
    const snap = snapshot(entityId, mode);
    if (!snap) return undefined;
    return snap[key];
  }

  /**
   * @param {number} entityId
   * @param {number} rawAmount
   * @param {string} [type]
   */
  function resolveDamage(entityId, rawAmount, type = "physical") {
    const id = Number(entityId || 0) | 0;
    const amount = Math.max(0, Number(rawAmount || 0) | 0);
    if (!(amount > 0) || !validEntity(id)) return 0;
    return Math.max(0, resolveResistance(world, id, amount, String(type || "physical").toLowerCase()));
  }

  /**
   * @param {number} entityId
   * @param {number} rawAmount
   * @param {string} [type]
   */
  function mitigation(entityId, rawAmount, type = "physical") {
    const input = Math.max(0, Number(rawAmount || 0) | 0);
    const finalAmount = resolveDamage(entityId, input, type);
    const prevented = Math.max(0, input - finalAmount);
    const ratio = input > 0 ? prevented / input : 0;
    return Object.freeze({
      entityId: Number(entityId || 0) | 0,
      type: String(type || "physical").toLowerCase(),
      rawAmount: input,
      finalAmount,
      prevented,
      ratio,
    });
  }

  return Object.freeze({
    snapshot,
    value,
    resolveDamage,
    mitigation,
    attackBonus(entityId, mode = "melee") {
      const v = value(entityId, "attackBonus", mode);
      return Number.isFinite(v) ? Number(v) : undefined;
    },
    armorClass(entityId, mode = "melee") {
      const v = value(entityId, "armorClass", mode);
      return Number.isFinite(v) ? Number(v) : undefined;
    },
    damageFlatBonus(entityId, mode = "melee") {
      const v = value(entityId, "damageFlatBonus", mode);
      return Number.isFinite(v) ? Number(v) : undefined;
    },
    actor(mode = "melee") { return snapshotFromAnchor("actor", mode); },
    primary(mode = "melee") { return snapshotFromAnchor("primary", mode); },
    target(mode = "melee") { return snapshotFromAnchor("target", mode); },
    attacker(mode = "melee") { return snapshotFromAnchor("attacker", mode); },
    defender(mode = "melee") { return snapshotFromAnchor("defender", mode); },
    actorMitigation(rawAmount, type = "physical") {
      const snap = snapshotFromAnchor("actor", "melee");
      return mitigation(snap?.entityId || 0, rawAmount, type);
    },
    targetMitigation(rawAmount, type = "physical") {
      const snap = snapshotFromAnchor("target", "melee");
      return mitigation(snap?.entityId || 0, rawAmount, type);
    },
    defenderMitigation(rawAmount, type = "physical") {
      const snap = snapshotFromAnchor("defender", "melee");
      return mitigation(snap?.entityId || 0, rawAmount, type);
    },
  });
}
