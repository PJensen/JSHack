import { Equipment, NON_AMMO_GEAR_SLOTS } from "../components/Equipment.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { PolymorphExposure } from "../components/PolymorphExposure.js";
import { PolymorphProfile } from "../components/PolymorphProfile.js";
import { Traits } from "../components/Traits.js";
import { getAllMonsters, getMonster } from "../data/monsters.js";
import { clamp01 } from "./numberCoerce.js";
import { getPassiveBonuses } from "./passiveBonuses.js";

function addSource(sources, source) {
  const key = String(source || "");
  if (key && !sources.includes(key)) sources.push(key);
}

function collectEquipmentControlSources(world, actorId, sources) {
  const eq = world.get(actorId, Equipment);
  if (!eq) return;
  for (const slot of NON_AMMO_GEAR_SLOTS) {
    const itemId = Number(eq[slot] || 0) | 0;
    if (!(itemId > 0) || !world.isAlive?.(itemId)) continue;
    const info = world.get(itemId, ItemInfo);
    const amount = Number(info?.bonuses?.polymorphControl || 0);
    if (!(amount > 0)) continue;
    const ident = world.get(itemId, NamedIdentity);
    addSource(sources, String(ident?.identity || ident?.name || `item:${itemId}`));
  }
}

/**
 * Resolve the actor's polymorph-control capability from permanent traits and
 * derived passive bonuses. Future surfaces should extend this function, not
 * scroll or UI code.
 *
 * @param {any} world
 * @param {number} actorId
 * @returns {{ hasControl:boolean, controlScore:number, powerScore:number, sources:string[] }}
 */
export function getPolymorphControl(world, actorId) {
  const id = Number(actorId || 0) | 0;
  const sources = [];
  if (!(id > 0) || !world?.isAlive?.(id)) {
    return Object.freeze({ hasControl: false, controlScore: 0, powerScore: 0, sources });
  }

  const traits = world.get(id, Traits);
  let controlScore = traits?.polymorph_control ? 1 : 0;
  if (traits?.polymorph_control) addSource(sources, "trait:polymorph_control");

  const passive = getPassiveBonuses(world, id);
  const passiveControl = Number(passive?.polymorphControlDerived || 0);
  const powerScore = Number(passive?.polymorphPowerDerived || 0);
  if (passiveControl > 0) {
    controlScore += passiveControl;
    collectEquipmentControlSources(world, id, sources);
    if (!sources.some((source) => source.startsWith("ring_") || source.startsWith("item:"))) {
      addSource(sources, "passive:polymorph_control");
    }
  }

  return Object.freeze({
    hasControl: controlScore > 0,
    controlScore,
    powerScore,
    sources: Object.freeze(sources),
  });
}

/**
 * Resolve a target's resistance to being polymorphed. Runtime components are
 * checked first so non-monster entities can opt into policy without pretending
 * to be content monsters. Monster authoring data is the fallback for ordinary
 * creatures.
 *
 * @param {any} world
 * @param {number} targetId
 * @returns {{ resistanceScore:number, stabilityScore:number, failureMode:string, exposureBonus:number, sources:string[] }}
 */
export function getPolymorphResistance(world, targetId) {
  const id = Number(targetId || 0) | 0;
  const sources = [];
  if (!(id > 0) || !world?.isAlive?.(id)) {
    return Object.freeze({ resistanceScore: 0, stabilityScore: 0, failureMode: "normal", exposureBonus: 0, sources });
  }

  let resistanceScore = 0;
  let stabilityScore = 0;
  let failureMode = "normal";

  const profile = world.get(id, PolymorphProfile);
  if (profile) {
    resistanceScore = clamp01(profile.resistance);
    stabilityScore = Math.max(0, Number(profile.stability || 0));
    failureMode = String(profile.failureMode || "normal");
    if (resistanceScore > 0 || stabilityScore > 0) addSource(sources, "component:polymorph_profile");
  } else {
    const identity = String(world.get(id, NamedIdentity)?.identity || "");
    const def = identity ? getMonster(identity) : null;
    resistanceScore = clamp01(def?.polymorphResistance || 0);
    stabilityScore = Math.max(0, Number(def?.polymorphStability || 0));
    failureMode = String(def?.polymorphFailureMode || "normal");
    if (resistanceScore > 0 || stabilityScore > 0) addSource(sources, `monster:${identity}`);
  }

  const passive = getPassiveBonuses(world, id);
  const passiveResistance = Number(passive?.polymorphResistanceDerived || 0);
  const passiveStability = Number(passive?.polymorphStabilityDerived || 0);
  if (passiveResistance > 0) {
    resistanceScore += passiveResistance;
    addSource(sources, "passive:polymorph_resistance");
  }
  if (passiveStability > 0) {
    stabilityScore += passiveStability;
    addSource(sources, "passive:polymorph_stability");
  }

  const exposure = world.get(id, PolymorphExposure);
  const exposureBonus = clamp01(exposure?.resistanceBonus || 0);
  if (exposureBonus > 0) {
    resistanceScore += exposureBonus;
    addSource(sources, "component:polymorph_exposure");
  }

  return Object.freeze({
    resistanceScore: clamp01(resistanceScore),
    stabilityScore,
    failureMode,
    exposureBonus,
    sources: Object.freeze(sources),
  });
}

function dangerScore(def) {
  const tags = Array.isArray(def?.tags) ? def.tags : [];
  const tier = Number(def?.tier || 0);
  if (tags.includes("draconic") || tags.includes("giant") || tier >= 4) return 2;
  if (tags.includes("caster") || tags.includes("venomous") || tags.includes("aberration") || tier >= 2) return 1;
  return 0;
}

function pickFumbledIdentity(world, requestedIdentity) {
  const pool = getAllMonsters()
    .filter((def) => def && !def.disabled && def.id !== requestedIdentity && dangerScore(def) === 0)
    .sort((a, b) => String(a.id || "").localeCompare(String(b.id || "")));
  if (!pool.length) return requestedIdentity;
  const idx = Math.floor(world.rand() * pool.length);
  return String(pool[Math.max(0, Math.min(pool.length - 1, idx))]?.id || requestedIdentity);
}

function failureReasonForResistance(resistance, controlled) {
  const mode = String(resistance?.failureMode || "normal");
  const stability = Number(resistance?.stabilityScore || 0);
  if (mode === "volatile" && stability < 2) return "volatile";
  if (mode === "fumble" && controlled && stability < 2) return "fumbled";
  return "resisted";
}

/**
 * Record a failed/partial polymorph attempt on a surviving target. This creates
 * diminishing returns: repeated attempts against the same still-living body
 * make that body temporarily harder to force.
 *
 * @param {any} world
 * @param {{ targetId?:number, outcome?:string, source?:string }} req
 * @returns {{ attempts:number, resistanceBonus:number }|null}
 */
export function recordPolymorphAttempt(world, req = {}) {
  const targetId = Number(req.targetId || 0) | 0;
  if (!(targetId > 0) || !world?.isAlive?.(targetId)) return null;
  const outcome = String(req.outcome || "failed");
  const source = String(req.source || "");
  const increment = outcome === "resisted" ? 0.15
    : outcome === "volatile" ? 0.12
      : outcome === "fumbled" ? 0.08
        : 0.06;

  if (!world.has(targetId, PolymorphExposure)) {
    world.add(targetId, PolymorphExposure, {
      attempts: 1,
      resistanceBonus: increment,
      maxBonus: 0.5,
      lastOutcome: outcome,
      lastSource: source,
    });
  } else {
    world.mutate(targetId, PolymorphExposure, (rec) => {
      rec.attempts = Math.max(0, Number(rec.attempts || 0) | 0) + 1;
      const maxBonus = clamp01(rec.maxBonus ?? 0.5);
      rec.resistanceBonus = Math.min(maxBonus, clamp01(rec.resistanceBonus || 0) + increment);
      rec.lastOutcome = outcome;
      rec.lastSource = source;
    });
  }
  const rec = world.get(targetId, PolymorphExposure);
  return rec ? { attempts: rec.attempts | 0, resistanceBonus: Number(rec.resistanceBonus || 0) } : null;
}

/**
 * Decide whether a polymorph attempt can proceed, and what final form should be
 * handed to the canonical resolver. This is intentionally pure policy: it does
 * not mutate entities, consume items, or emit UI messages.
 *
 * @param {any} world
 * @param {{ actorId?:number, targetId?:number, requestedIdentity?:string, source?:string, controlled?:boolean, ignoreTargetResistance?:boolean }} req
 * @returns {{ success:boolean, targetIdentity:string, requestedIdentity:string, failureReason:""|"invalid"|"resisted"|"fumbled"|"volatile", resisted:boolean, fumbled:boolean, volatile:boolean, control:ReturnType<typeof getPolymorphControl>, resistance:ReturnType<typeof getPolymorphResistance> }}
 */
export function resolvePolymorphAttempt(world, req = {}) {
  const actorId = Number(req.actorId || 0) | 0;
  const targetId = Number(req.targetId || 0) | 0;
  const requestedIdentity = String(req.requestedIdentity || "").trim();
  const control = getPolymorphControl(world, actorId);
  const resistance = getPolymorphResistance(world, targetId);

  if (!requestedIdentity || !getMonster(requestedIdentity)) {
    return Object.freeze({
      success: false,
      targetIdentity: "",
      requestedIdentity,
      failureReason: "invalid",
      resisted: false,
      fumbled: false,
      volatile: false,
      control,
      resistance,
    });
  }

  const resistanceChance = req.ignoreTargetResistance
    ? 0
    : clamp01(resistance.resistanceScore - (Number(control.powerScore || 0) * 0.15));
  if (resistanceChance > 0 && world.rand() < resistanceChance) {
    const failureReason = failureReasonForResistance(resistance, Boolean(req.controlled));
    if (failureReason === "fumbled") {
      return Object.freeze({
        success: true,
        targetIdentity: pickFumbledIdentity(world, requestedIdentity),
        requestedIdentity,
        failureReason,
        resisted: false,
        fumbled: true,
        volatile: false,
        control,
        resistance,
      });
    }
    return Object.freeze({
      success: false,
      targetIdentity: requestedIdentity,
      requestedIdentity,
      failureReason,
      resisted: failureReason === "resisted",
      fumbled: false,
      volatile: failureReason === "volatile",
      control,
      resistance,
    });
  }

  const targetDef = getMonster(requestedIdentity);
  const requiredControl = dangerScore(targetDef) >= 2 ? 2 : 1;
  const controlled = Boolean(req.controlled);
  const fumbleChance = controlled
    ? clamp01((requiredControl - Number(control.controlScore || 0)) * 0.25 - (Number(control.powerScore || 0) * 0.10))
    : 0;
  if (fumbleChance > 0 && world.rand() < fumbleChance) {
    return Object.freeze({
      success: true,
      targetIdentity: pickFumbledIdentity(world, requestedIdentity),
      requestedIdentity,
      failureReason: "fumbled",
      resisted: false,
      fumbled: true,
      volatile: false,
      control,
      resistance,
    });
  }

  return Object.freeze({
    success: true,
    targetIdentity: requestedIdentity,
    requestedIdentity,
    failureReason: "",
    resisted: false,
    fumbled: false,
    volatile: false,
    control,
    resistance,
  });
}
