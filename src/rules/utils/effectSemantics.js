import { EFFECT_DEFS } from "../data/effectDefs.js";

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function readInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n | 0;
}

function readNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Lower-cased lookup keyed by effect keys and status aliases.
 * Values carry semantic family + canonical status key from EFFECT_DEFS.
 * @type {Map<string, { familyKey: string, operation: string, statusKey: string }>}
 */
const META_BY_KEY = (() => {
  const map = new Map();
  for (let i = 0; i < EFFECT_DEFS.length; i++) {
    const def = EFFECT_DEFS[i];
    const familyKey = normalizeKey(def?.id);
    const operation = String(def?.operation || "none").toLowerCase();
    const statusKey = normalizeKey(def?.statuses?.[0] || def?.keys?.[0] || familyKey);
    const keys = []
      .concat(Array.isArray(def?.keys) ? def.keys : [])
      .concat(Array.isArray(def?.statuses) ? def.statuses : []);
    for (let k = 0; k < keys.length; k++) {
      const key = normalizeKey(keys[k]);
      if (!key || map.has(key)) continue;
      map.set(key, { familyKey: familyKey || key, operation, statusKey: statusKey || key });
    }
  }
  return map;
})();

function familyKeyFor(rawKey) {
  const key = normalizeKey(rawKey);
  if (!key) return "";
  return META_BY_KEY.get(key)?.familyKey || key;
}

function mergeDotRecord(target, incoming) {
  target.turnsLeft = Math.max(readInt(target.turnsLeft, 0), readInt(incoming.turnsLeft, 0));
  target.potency = Math.max(readNumber(target.potency, 1), readNumber(incoming.potency, 1));
  target.stacks = 1;

  const hasIncomingOnset = Number.isFinite(Number(incoming?.onsetLeft));
  if (hasIncomingOnset) {
    const curOnset = Math.max(0, readInt(target.onsetLeft, 0));
    const nextOnset = Math.max(0, readInt(incoming.onsetLeft, 0));
    target.onsetLeft = Math.min(curOnset, nextOnset);
  } else if (target.onsetLeft != null) {
    target.onsetLeft = Math.max(0, readInt(target.onsetLeft, 0));
  }

  if (Number.isFinite(Number(incoming?.startedAtTurn))) {
    target.startedAtTurn = readInt(incoming.startedAtTurn, 0);
  }
  if (Number.isFinite(Number(incoming?.sourceId))) {
    target.sourceId = readInt(incoming.sourceId, 0);
  }

  if (incoming?.meta && typeof incoming.meta === "object") {
    const curMeta = target?.meta && typeof target.meta === "object" ? target.meta : {};
    target.meta = { ...curMeta, ...incoming.meta };
  }
}

/**
 * True when an effect key resolves to an operation:'damage' definition.
 * Used for DOT-like status semantics (refresh duration, do not stack intensity).
 * @param {unknown} rawKey
 */
export function isDotEffectKey(rawKey) {
  const key = normalizeKey(rawKey);
  if (!key) return false;
  return META_BY_KEY.get(key)?.operation === "damage";
}

/**
 * Canonicalize effect/status aliases for UI presentation.
 * Example: poison -> poisoned, burn -> burning.
 * @param {unknown} rawKey
 */
export function canonicalStatusKey(rawKey) {
  const key = normalizeKey(rawKey);
  if (!key) return "";
  return META_BY_KEY.get(key)?.statusKey || key;
}

/**
 * Upsert one timed effect entry into an ActiveEffects array.
 * DOT keys refresh duration and keep stacks at 1.
 * Non-DOT keys keep existing stack semantics.
 *
 * @param {Array<any>} effects
 * @param {any} effect
 * @returns {any|null}
 */
export function upsertTimedEffect(effects, effect) {
  if (!Array.isArray(effects) || !effect || typeof effect !== "object") return null;
  const key = normalizeKey(effect.key);
  if (!key) return null;

  const rec = {
    stacks: 1,
    ...effect,
    key,
  };
  if (rec.turnsLeft == null && rec.duration != null) rec.turnsLeft = rec.duration;
  rec.turnsLeft = Math.max(0, readInt(rec.turnsLeft, 0));
  rec.stacks = Math.max(1, readInt(rec.stacks, 1));
  rec.potency = readNumber(rec.potency, 1);

  if (isDotEffectKey(key)) {
    const family = familyKeyFor(key);
    /** @type {number[]} */
    const matches = [];
    for (let i = 0; i < effects.length; i++) {
      const e = effects[i];
      if (!e || typeof e !== "object") continue;
      const eKey = normalizeKey(e.key);
      if (!eKey) continue;
      if (!isDotEffectKey(eKey)) continue;
      if (familyKeyFor(eKey) !== family) continue;
      matches.push(i);
    }

    if (matches.length > 0) {
      const target = effects[matches[0]];
      mergeDotRecord(target, rec);
      for (let i = 1; i < matches.length; i++) {
        const idx = matches[i];
        const duplicate = effects[idx];
        if (duplicate && typeof duplicate === "object") mergeDotRecord(target, duplicate);
      }
      for (let i = matches.length - 1; i >= 1; i--) {
        effects.splice(matches[i], 1);
      }
      return target;
    }

    rec.stacks = 1;
    effects.push(rec);
    return rec;
  }

  let existing = null;
  for (let i = 0; i < effects.length; i++) {
    const e = effects[i];
    if (!e || typeof e !== "object") continue;
    if (normalizeKey(e.key) !== key) continue;
    existing = e;
    break;
  }
  if (existing) {
    existing.stacks = Math.max(1, readInt(existing.stacks, 1)) + Math.max(1, readInt(rec.stacks, 1));
    existing.turnsLeft = Math.max(readInt(existing.turnsLeft, 0), readInt(rec.turnsLeft, 0));
    existing.potency = Math.max(readNumber(existing.potency, 1), readNumber(rec.potency, 1));
    return existing;
  }

  effects.push(rec);
  return rec;
}

/**
 * Collapse duplicate DOT entries by family and force stacks=1.
 * @param {Array<any>} effects
 */
export function compactDotEffects(effects) {
  if (!Array.isArray(effects) || effects.length <= 0) return;

  /** @type {Map<string, number>} */
  const familyToPrimaryIndex = new Map();
  /** @type {number[]} */
  const remove = [];

  for (let i = 0; i < effects.length; i++) {
    const e = effects[i];
    if (!e || typeof e !== "object") continue;
    const key = normalizeKey(e.key);
    if (!key || !isDotEffectKey(key)) continue;

    e.key = key;
    e.stacks = 1;
    const family = familyKeyFor(key);
    const primaryIndex = familyToPrimaryIndex.get(family);
    if (primaryIndex == null) {
      familyToPrimaryIndex.set(family, i);
      continue;
    }

    const primary = effects[primaryIndex];
    if (primary && typeof primary === "object") mergeDotRecord(primary, e);
    remove.push(i);
  }

  if (remove.length <= 0) return;
  for (let i = remove.length - 1; i >= 0; i--) {
    effects.splice(remove[i], 1);
  }
}
