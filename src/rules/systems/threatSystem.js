import { AggroState } from "../components/AggroState.js";
import { Faction } from "../components/Faction.js";
import { Vitality } from "../components/Vitality.js";
import { SPELL_DEFS } from "../data/spells.js";
import { areFactionsHostile } from "../utils/factionHostility.js";
import {
  addThreat,
  clearThreatFromSource,
  decayThreat,
  forceThreatTarget,
  getThreatGenerationMultiplier,
  reduceThreatFromSource,
  resolveThreatTarget,
  THREAT_SOFT_TAUNT_BURST,
} from "../utils/threat.js";

const THREAT_LISTENERS_INSTALLED = Symbol.for("jshack:threat:listeners:installed");

function factionsHostile(world, sourceId, targetId) {
  const sourceFaction = String(world.get(sourceId, Faction)?.key || "");
  const targetFaction = String(world.get(targetId, Faction)?.key || "");
  return !!sourceFaction && !!targetFaction && areFactionsHostile(sourceFaction, targetFaction);
}

function canReceiveThreat(world, sourceId, targetId) {
  const source = Number(sourceId || 0) | 0;
  const target = Number(targetId || 0) | 0;
  if (!(source > 0) || !(target > 0) || source === target) return false;
  if (!world.isAlive(source) || !world.isAlive(target)) return false;
  if (!world.get(target, AggroState)) return false;
  const vit = world.get(target, Vitality);
  if (vit && (Number(vit.hp || 0) | 0) <= 0) return false;
  return factionsHostile(world, source, target);
}

function addFlatThreat(world, targetId, sourceId, amount, kind, reason = kind) {
  if (!canReceiveThreat(world, sourceId, targetId)) return false;
  const value = Math.max(1, Number(amount || 0) | 0);
  const mult = getThreatGenerationMultiplier(world, sourceId);
  addThreat(world, targetId, sourceId, Math.max(1, Math.floor((value * mult) + 1e-6)), { kind });
  resolveThreatTarget(world, targetId, { reason });
  return true;
}

function addFlatThreatToTargets(world, targetIds, sourceId, amount, kind, reason = kind) {
  if (!Array.isArray(targetIds)) return 0;
  let added = 0;
  for (let i = 0; i < targetIds.length; i++) {
    if (addFlatThreat(world, targetIds[i], sourceId, amount, kind, reason)) added++;
  }
  return added;
}

function normalizeSpellId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.startsWith("spell:") ? raw.slice(6) : raw;
}

function readSpellThreatSpec(spellId) {
  const id = normalizeSpellId(spellId);
  const spec = id ? SPELL_DEFS[id]?.threat : null;
  return spec && typeof spec === "object" ? spec : null;
}

function payloadField(payload, field, fallback = undefined) {
  const key = String(field || "");
  if (!key) return fallback;
  return payload && Object.prototype.hasOwnProperty.call(payload, key) ? payload[key] : fallback;
}

function applySpellThreat(world, eventName, payload = {}) {
  const spellId = normalizeSpellId(payload.spellId || eventName);
  const spec = readSpellThreatSpec(spellId);
  if (!spec) return 0;
  if (payload.fizzle || payload.missed) return 0;
  const requiredField = String(spec.requiresField || "");
  if (requiredField && !payloadField(payload, requiredField, false)) return 0;

  const actor = Number(payload.actor || payload.source || 0) | 0;
  if (!(actor > 0)) return 0;

  const amount = Math.max(0, Number(spec.flatThreat || 0) | 0);
  if (amount <= 0) return 0;
  const kind = String(spec.threatKind || "spell");
  const reason = `spell:${spellId}`;
  const targetField = String(spec.targetField || "targetId");
  const targetsField = String(spec.targetsField || "");

  if (targetsField) {
    return addFlatThreatToTargets(world, payloadField(payload, targetsField, []), actor, amount, kind, reason);
  }
  return addFlatThreat(world, payloadField(payload, targetField, 0), actor, amount, kind, reason) ? 1 : 0;
}

export function installThreatListeners(world) {
  if (!world || world[THREAT_LISTENERS_INSTALLED]) return;
  world[THREAT_LISTENERS_INSTALLED] = true;

  world.on("damaged", ({ target, source, amount, cause }) => {
    const owner = Number(target || 0) | 0;
    const actor = Number(source || 0) | 0;
    const value = Math.max(0, Number(amount || 0) | 0);
    if (!(owner > 0) || !(actor > 0) || value <= 0) return;
    const mult = getThreatGenerationMultiplier(world, actor);
    addThreat(world, owner, actor, Math.max(1, Math.floor((value * mult) + 1e-6)), { kind: String(cause || "damage") });
    resolveThreatTarget(world, owner, { reason: "damage" });
  });

  world.on("threat:add", ({ ownerId, targetId, sourceId, amount, kind, reason, sticky }) => {
    const owner = Number(ownerId || targetId || 0) | 0;
    const source = Number(sourceId || 0) | 0;
    if (!(owner > 0) || !(source > 0)) return;
    addThreat(world, owner, source, amount, { kind: String(kind || reason || "threat"), sticky: !!sticky });
    resolveThreatTarget(world, owner, { reason: String(reason || kind || "threat") });
  });

  world.on("ranged:missed-target", ({ attacker, target }) => {
    addFlatThreat(world, target, attacker, 1, "ranged_miss", "ranged_miss");
  });

  world.on("spell:blind", (payload) => applySpellThreat(world, "blind", payload));
  world.on("spell:entangle", (payload) => applySpellThreat(world, "entangle", payload));
  world.on("spell:mark_of_death", (payload) => applySpellThreat(world, "mark_of_death", payload));
  world.on("spell:web_spit", (payload) => applySpellThreat(world, "web_spit", payload));
  world.on("spell:mass_delirium", (payload) => applySpellThreat(world, "mass_delirium", payload));
  world.on("spell:war_cry", (payload) => applySpellThreat(world, "war_cry", payload));

  world.on("taunt:applied", ({ targetId, sourceId, turnsLeft, potency, reason }) => {
    const owner = Number(targetId || 0) | 0;
    const source = Number(sourceId || 0) | 0;
    if (!(owner > 0) || !(source > 0)) return;
    const r = String(reason || "taunt");
    if (r === "pet_protect") {
      addThreat(world, owner, source, Math.max(1, Number(potency || 1) | 0) * THREAT_SOFT_TAUNT_BURST, {
        kind: "body_block",
        sticky: true,
      });
      resolveThreatTarget(world, owner, { reason: "pet_protect" });
      return;
    }
    forceThreatTarget(world, owner, source, Math.max(1, Number(turnsLeft || 1) | 0), {
      reason: "taunt",
      kind: "taunt",
    });
  });

  world.on("spell:smoke_bomb", ({ actor }) => {
    const source = Number(actor || 0) | 0;
    if (!(source > 0)) return;
    clearThreatFromSource(world, source, { reason: "smoke_bomb" });
  });

  world.on("spell:blink", ({ actor }) => {
    const source = Number(actor || 0) | 0;
    if (!(source > 0)) return;
    reduceThreatFromSource(world, source, { percent: 0.5, amount: 2, reason: "blink" });
  });

  world.on("spell:shadow_veil", ({ actor }) => {
    const source = Number(actor || 0) | 0;
    if (!(source > 0)) return;
    reduceThreatFromSource(world, source, { percent: 0.75, amount: 4, reason: "shadow_veil" });
  });

  world.on("threat:drop-source", ({ sourceId, actor, percent, amount, reason, clear }) => {
    const source = Number(sourceId || actor || 0) | 0;
    if (!(source > 0)) return;
    if (clear) clearThreatFromSource(world, source, { reason: String(reason || "threat_drop") });
    else reduceThreatFromSource(world, source, { percent, amount, reason: String(reason || "threat_drop") });
  });
}

export function threatSystem(world) {
  for (const [id, aggro] of world.query(AggroState)) {
    if (!world.isAlive(id)) continue;
    const faction = world.get(id, Faction);
    if (faction && String(faction.key || "") !== "enemy") continue;
    decayThreat(world, id);
    resolveThreatTarget(world, id, { reason: "threat" });
  }
}
