import { ActiveEffects } from "../components/ActiveEffects.js";
import { Status } from "../components/Status.js";
import { EFFECT_DEFS } from "../data/effectDefs.js";

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function hasPositiveDuration(duration) {
  return (Number(duration || 0) | 0) > 0;
}

function normalizeStrength(potency, stacks) {
  const p = Number.isFinite(potency) ? Number(potency) : 1;
  const s = Number.isInteger(stacks) && stacks > 0 ? stacks : 1;
  return Math.max(1, Math.round(Math.max(0, p) * s));
}

/**
 * @param {any} effect
 */
function isActiveEffect(effect) {
  if (!effect || typeof effect !== "object") return false;
  if ((Number(effect.onsetLeft || 0) | 0) > 0) return false;
  return hasPositiveDuration(effect.turnsLeft);
}

/**
 * Map effect keys -> projected semantic statuses.
 * Lower-cased on build.
 */
const EFFECT_KEY_TO_STATUSES = (() => {
  /** @type {Map<string, string[]>} */
  const out = new Map();
  for (let i = 0; i < EFFECT_DEFS.length; i++) {
    const def = EFFECT_DEFS[i];
    const keys = Array.isArray(def?.keys) ? def.keys : [];
    const statuses = Array.isArray(def?.statuses)
      ? def.statuses.map((s) => normalizeKey(s)).filter(Boolean)
      : [];
    if (statuses.length <= 0) continue;
    for (let k = 0; k < keys.length; k++) {
      const key = normalizeKey(keys[k]);
      if (!key || out.has(key)) continue;
      out.set(key, statuses);
    }
  }
  return out;
})();

function validEntity(world, entityId) {
  const id = Number(entityId || 0) | 0;
  if (!(id > 0)) return false;
  if (typeof world?.isAlive === "function") return !!world.isAlive(id);
  return true;
}

/**
 * Build an ActiveEffects-first status/effect snapshot for one entity.
 *
 * - Effects are read from ActiveEffects where turnsLeft > 0 and onsetLeft <= 0.
 * - Statuses are projected from active effects via EFFECT_DEFS.
 * - If a status has no projected active-effect value, falls back to Status component.
 *
 * @param {{ get:(id:number, Comp:any)=>any, isAlive?:(id:number)=>boolean }} world
 * @param {number} entityId
 */
export function snapshotStatusState(world, entityId) {
  const id = Number(entityId || 0) | 0;
  if (!validEntity(world, id)) return null;

  /** @type {Map<string, number>} */
  const effectStrengths = new Map();
  /** @type {Map<string, number>} */
  const projectedStatusStrengths = new Map();

  const ae = world.get(id, ActiveEffects);
  const effects = Array.isArray(ae?.effects) ? ae.effects : [];
  for (let i = 0; i < effects.length; i++) {
    const e = effects[i];
    if (!isActiveEffect(e)) continue;
    const key = normalizeKey(e.key);
    if (!key) continue;

    const strength = normalizeStrength(e.potency, e.stacks);
    effectStrengths.set(key, (effectStrengths.get(key) || 0) + strength);

    const statuses = EFFECT_KEY_TO_STATUSES.get(key);
    if (!Array.isArray(statuses) || statuses.length <= 0) continue;
    for (let s = 0; s < statuses.length; s++) {
      const statusType = statuses[s];
      projectedStatusStrengths.set(statusType, (projectedStatusStrengths.get(statusType) || 0) + strength);
    }
  }

  /** @type {Map<string, number>} */
  const statusStrengths = new Map(projectedStatusStrengths);
  const stat = world.get(id, Status);
  if (stat && Array.isArray(stat.statuses)) {
    for (let i = 0; i < stat.statuses.length; i++) {
      const s = stat.statuses[i];
      const type = normalizeKey(s?.type);
      if (!type) continue;
      if (!hasPositiveDuration(s?.duration)) continue;
      // ActiveEffects is canonical for projected statuses.
      if (projectedStatusStrengths.has(type)) continue;
      const strength = normalizeStrength(s?.potency, s?.stacks);
      statusStrengths.set(type, (statusStrengths.get(type) || 0) + strength);
    }
  }

  const effectRows = Array.from(effectStrengths.entries())
    .map(([key, strength]) => Object.freeze({ key, strength }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const derivedStatusRows = Array.from(projectedStatusStrengths.entries())
    .map(([type, strength]) => Object.freeze({ type, strength }))
    .sort((a, b) => a.type.localeCompare(b.type));
  const allStatusRows = Array.from(statusStrengths.entries())
    .map(([type, strength]) => Object.freeze({ type, strength }))
    .sort((a, b) => a.type.localeCompare(b.type));

  return Object.freeze({
    entityId: id,
    effects: Object.freeze(effectRows),
    // Semantic status list is derived from active effects.
    statuses: Object.freeze(derivedStatusRows),
    // Compatibility list includes fallback Status-only entries.
    allStatuses: Object.freeze(allStatusRows),
    effectStrengths,
    derivedStatusStrengths: projectedStatusStrengths,
    statusStrengths,
  });
}

/**
 * @param {{ get:(id:number, Comp:any)=>any, isAlive?:(id:number)=>boolean }} world
 * @param {number} entityId
 * @param {string} effectKey
 */
export function effectStrength(world, entityId, effectKey) {
  const key = normalizeKey(effectKey);
  if (!key) return 0;
  const snap = snapshotStatusState(world, entityId);
  if (!snap) return 0;
  return Number(snap.effectStrengths.get(key) || 0);
}

/**
 * @param {{ get:(id:number, Comp:any)=>any, isAlive?:(id:number)=>boolean }} world
 * @param {number} entityId
 * @param {string} effectKey
 */
export function hasEffect(world, entityId, effectKey) {
  return effectStrength(world, entityId, effectKey) > 0;
}

/**
 * @param {{ get:(id:number, Comp:any)=>any, isAlive?:(id:number)=>boolean }} world
 * @param {number} entityId
 * @param {string} statusType
 */
export function statusStrength(world, entityId, statusType) {
  const key = normalizeKey(statusType);
  if (!key) return 0;
  const snap = snapshotStatusState(world, entityId);
  if (!snap) return 0;
  return Number(snap.statusStrengths.get(key) || 0);
}

/**
 * @param {{ get:(id:number, Comp:any)=>any, isAlive?:(id:number)=>boolean }} world
 * @param {number} entityId
 * @param {string} statusType
 */
export function hasStatus(world, entityId, statusType) {
  return statusStrength(world, entityId, statusType) > 0;
}

/**
 * @param {{ get:(id:number, Comp:any)=>any, isAlive?:(id:number)=>boolean }} world
 * @param {number} entityId
 * @param {string[]} statusTypes
 */
export function hasAnyStatus(world, entityId, statusTypes) {
  if (!Array.isArray(statusTypes) || statusTypes.length <= 0) return false;
  for (let i = 0; i < statusTypes.length; i++) {
    if (hasStatus(world, entityId, statusTypes[i])) return true;
  }
  return false;
}

/**
 * Status/effect facade with per-context memoization.
 *
 * @param {{ get:(id:number, Comp:any)=>any, isAlive?:(id:number)=>boolean }} world
 * @param {{
 *   actor?: () => number,
 *   primary?: () => number,
 *   target?: () => number,
 *   attacker?: () => number,
 *   defender?: () => number,
 * }} [anchors]
 */
export function createStatusFacade(world, anchors = {}) {
  const cache = new Map();

  /**
   * @param {number} entityId
   */
  function snapshot(entityId) {
    const id = Number(entityId || 0) | 0;
    if (!validEntity(world, id)) return null;
    if (cache.has(id)) return cache.get(id);
    const next = snapshotStatusState(world, id);
    cache.set(id, next);
    return next;
  }

  /**
   * @param {number} entityId
   * @param {string} key
   */
  function readStatusStrength(entityId, key) {
    const normalized = normalizeKey(key);
    if (!normalized) return 0;
    const snap = snapshot(entityId);
    if (!snap) return 0;
    return Number(snap.statusStrengths.get(normalized) || 0);
  }

  /**
   * @param {number} entityId
   * @param {string} key
   */
  function readEffectStrength(entityId, key) {
    const normalized = normalizeKey(key);
    if (!normalized) return 0;
    const snap = snapshot(entityId);
    if (!snap) return 0;
    return Number(snap.effectStrengths.get(normalized) || 0);
  }

  /**
   * @param {"actor"|"primary"|"target"|"attacker"|"defender"} name
   */
  function readAnchorId(name) {
    const getter = anchors[name];
    return typeof getter === "function" ? (getter() | 0) : 0;
  }

  /**
   * @param {"actor"|"primary"|"target"|"attacker"|"defender"} name
   */
  function snapshotFromAnchor(name) {
    return snapshot(readAnchorId(name));
  }

  /**
   * @param {"actor"|"primary"|"target"|"attacker"|"defender"} name
   * @param {string} statusType
   */
  function anchorHasStatus(name, statusType) {
    return readStatusStrength(readAnchorId(name), statusType) > 0;
  }

  /**
   * @param {"actor"|"primary"|"target"|"attacker"|"defender"} name
   * @param {string} statusType
   */
  function anchorStatusStrength(name, statusType) {
    return readStatusStrength(readAnchorId(name), statusType);
  }

  return Object.freeze({
    snapshot,
    hasStatus(entityId, statusType) {
      return readStatusStrength(entityId, statusType) > 0;
    },
    statusStrength(entityId, statusType) {
      return readStatusStrength(entityId, statusType);
    },
    hasAnyStatus(entityId, statusTypes) {
      if (!Array.isArray(statusTypes) || statusTypes.length <= 0) return false;
      for (let i = 0; i < statusTypes.length; i++) {
        if (readStatusStrength(entityId, statusTypes[i]) > 0) return true;
      }
      return false;
    },
    hasEffect(entityId, effectKey) {
      return readEffectStrength(entityId, effectKey) > 0;
    },
    effectStrength(entityId, effectKey) {
      return readEffectStrength(entityId, effectKey);
    },
    actor() { return snapshotFromAnchor("actor"); },
    primary() { return snapshotFromAnchor("primary"); },
    target() { return snapshotFromAnchor("target"); },
    attacker() { return snapshotFromAnchor("attacker"); },
    defender() { return snapshotFromAnchor("defender"); },
    actorHasStatus(statusType) { return anchorHasStatus("actor", statusType); },
    targetHasStatus(statusType) { return anchorHasStatus("target", statusType); },
    attackerHasStatus(statusType) { return anchorHasStatus("attacker", statusType); },
    defenderHasStatus(statusType) { return anchorHasStatus("defender", statusType); },
    actorStatusStrength(statusType) { return anchorStatusStrength("actor", statusType); },
    targetStatusStrength(statusType) { return anchorStatusStrength("target", statusType); },
    attackerStatusStrength(statusType) { return anchorStatusStrength("attacker", statusType); },
    defenderStatusStrength(statusType) { return anchorStatusStrength("defender", statusType); },
  });
}
