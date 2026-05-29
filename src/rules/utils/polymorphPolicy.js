import { Equipment, NON_AMMO_GEAR_SLOTS } from "../components/Equipment.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
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
 * @returns {{ resistanceScore:number, stabilityScore:number, failureMode:string, sources:string[] }}
 */
export function getPolymorphResistance(world, targetId) {
  const id = Number(targetId || 0) | 0;
  const sources = [];
  if (!(id > 0) || !world?.isAlive?.(id)) {
    return Object.freeze({ resistanceScore: 0, stabilityScore: 0, failureMode: "normal", sources });
  }

  const profile = world.get(id, PolymorphProfile);
  if (profile) {
    const resistanceScore = clamp01(profile.resistance);
    const stabilityScore = Math.max(0, Number(profile.stability || 0));
    const failureMode = String(profile.failureMode || "normal");
    if (resistanceScore > 0 || stabilityScore > 0) addSource(sources, "component:polymorph_profile");
    return Object.freeze({ resistanceScore, stabilityScore, failureMode, sources: Object.freeze(sources) });
  }

  const identity = String(world.get(id, NamedIdentity)?.identity || "");
  const def = identity ? getMonster(identity) : null;
  const resistanceScore = clamp01(def?.polymorphResistance || 0);
  const stabilityScore = Math.max(0, Number(def?.polymorphStability || 0));
  const failureMode = String(def?.polymorphFailureMode || "normal");
  if (resistanceScore > 0 || stabilityScore > 0) addSource(sources, `monster:${identity}`);
  return Object.freeze({ resistanceScore, stabilityScore, failureMode, sources: Object.freeze(sources) });
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

/**
 * Decide whether a polymorph attempt can proceed, and what final form should be
 * handed to the canonical resolver. This is intentionally pure policy: it does
 * not mutate entities, consume items, or emit UI messages.
 *
 * @param {any} world
 * @param {{ actorId?:number, targetId?:number, requestedIdentity?:string, source?:string, controlled?:boolean }} req
 * @returns {{ success:boolean, targetIdentity:string, requestedIdentity:string, failureReason:""|"invalid"|"resisted"|"fumbled", resisted:boolean, fumbled:boolean, control:ReturnType<typeof getPolymorphControl>, resistance:ReturnType<typeof getPolymorphResistance> }}
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
      control,
      resistance,
    });
  }

  const resistanceChance = clamp01(resistance.resistanceScore - (Number(control.powerScore || 0) * 0.15));
  if (resistanceChance > 0 && world.rand() < resistanceChance) {
    return Object.freeze({
      success: false,
      targetIdentity: requestedIdentity,
      requestedIdentity,
      failureReason: "resisted",
      resisted: true,
      fumbled: false,
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
    control,
    resistance,
  });
}
