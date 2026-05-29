import { attach, children } from "../../lib/ecs-js/hierarchy.js";
import { Faction } from "../components/Faction.js";
import { Reputation, REPUTATION_BANDS } from "../components/Reputation.js";
import { OFFENSE_SEVERITY, OFFENSE_SOURCES } from "../data/offenses.js";
import { emitSafe } from "./emitSafe.js";

const INSTALLED = Symbol.for("jshack:reputation:offense-listeners:installed");

function normId(value) {
  return Number(value || 0) | 0;
}

function normKey(value, fallback = "unknown") {
  const key = String(value || "").trim().toLowerCase();
  return key || fallback;
}

function clampScore(value) {
  return Math.max(-100, Math.min(100, Number(value || 0)));
}

function clampSeverity(value) {
  return Math.max(0, Math.min(5, Number(value || 0) | 0));
}

function severityDelta(severity) {
  switch (clampSeverity(severity)) {
    case OFFENSE_SEVERITY.minor: return -3;
    case OFFENSE_SEVERITY.serious: return -10;
    case OFFENSE_SEVERITY.major: return -20;
    case OFFENSE_SEVERITY.severe: return -35;
    case OFFENSE_SEVERITY.unforgivable: return -60;
    default: return 0;
  }
}

export function reputationBand(score) {
  const n = clampScore(score);
  if (n <= -80) return REPUTATION_BANDS.infamous;
  if (n <= -55) return REPUTATION_BANDS.wanted;
  if (n <= -30) return REPUTATION_BANDS.notorious;
  if (n <= -10) return REPUTATION_BANDS.suspect;
  if (n >= 30) return REPUTATION_BANDS.honored;
  return REPUTATION_BANDS.neutral;
}

export function getReputationRecord(world, objectId, scopeKind = "town", scopeKey = "overworld") {
  const object = normId(objectId);
  const kind = normKey(scopeKind, "town");
  const key = normKey(scopeKey, "overworld");
  if (!(object > 0)) return null;

  if (world?.isAlive?.(object)) {
    for (const childId of children(world, object)) {
      const rec = world.get(childId, Reputation);
      if (
        rec &&
        normId(rec.objectId) === object &&
        normKey(rec.scopeKind, "town") === kind &&
        normKey(rec.scopeKey, "overworld") === key
      ) {
        return Object.freeze({ id: childId | 0, ...rec, band: reputationBand(rec.score) });
      }
    }
  }

  for (const [id, rec] of world.query(Reputation)) {
    if (
      normId(rec.objectId) === object &&
      normKey(rec.scopeKind, "town") === kind &&
      normKey(rec.scopeKey, "overworld") === key
    ) {
      return Object.freeze({ id: id | 0, ...rec, band: reputationBand(rec.score) });
    }
  }
  return null;
}

function upsertReputation(world, objectId, scopeKind, scopeKey, patch) {
  const object = normId(objectId);
  if (!(object > 0)) return null;

  const existing = getReputationRecord(world, object, scopeKind, scopeKey);
  const next = {
    objectId: object,
    scopeKind: normKey(scopeKind, "town"),
    scopeKey: normKey(scopeKey, "overworld"),
    score: clampScore((existing?.score || 0) + Number(patch.delta || 0)),
    maxSeverity: Math.max(clampSeverity(existing?.maxSeverity || 0), clampSeverity(patch.severity || 0)),
    lastOffenseTurn: Number(patch.turn || 0) | 0,
    lastOffenseKind: String(patch.offenseKind || existing?.lastOffenseKind || "none"),
    witnessCount: Math.max(0, Number(existing?.witnessCount || 0) + Number(patch.witnessCount || 0)),
  };

  const id = existing?.id || world.create();
  if (existing) world.set(id, Reputation, next);
  else {
    world.add(id, Reputation, next);
    if (world?.isAlive?.(object)) attach(world, id, object);
  }
  return Object.freeze({ id: id | 0, ...next, band: reputationBand(next.score) });
}

function victimFaction(world, victimId) {
  return normKey(world.get(victimId, Faction)?.key, "");
}

function reputationScopesFor(world, victimId, offense) {
  const scopes = [{ scopeKind: "town", scopeKey: "overworld" }];
  const faction = victimFaction(world, victimId);
  if (faction === "shopkeeper" || offense?.source === OFFENSE_SOURCES.shopLaw) {
    scopes.push({ scopeKind: "faction", scopeKey: "shopkeeper" });
  } else if (faction === "townfolk" || faction === "neutral") {
    scopes.push({ scopeKind: "faction", scopeKey: "townfolk" });
  }
  return scopes;
}

export function applyOffenseReputation(world, spec = {}) {
  const actorId = normId(spec.actorId ?? spec.actor);
  const victimId = normId(spec.victimId ?? spec.targetId ?? spec.shopkeeperId);
  if (!(actorId > 0)) return null;

  const offense = spec.offense || {};
  const severity = clampSeverity(spec.severity ?? offense.severity);
  const offenseKind = String(spec.offenseKind || offense.offenseKind || "unknown");
  const witnessIds = Array.isArray(spec.witnessIds) ? spec.witnessIds.map(normId).filter((id) => id > 0) : [];
  const publicKnown = spec.publicKnown === true || witnessIds.length > 0 || offense.source === OFFENSE_SOURCES.shopLaw;
  if (!publicKnown) return null;

  const baseDelta = severityDelta(severity);
  if (baseDelta === 0) return null;

  const witnessCount = Math.max(1, witnessIds.length || (offense.source === OFFENSE_SOURCES.shopLaw ? 1 : 0));
  const witnessAmplifier = Math.min(2.0, 1 + Math.max(0, witnessCount - 1) * 0.15);
  const delta = Math.floor(baseDelta * witnessAmplifier);
  const turn = Number(spec.turn ?? world?.step ?? 0) | 0;
  const scopes = Array.isArray(spec.scopes) && spec.scopes.length
    ? spec.scopes
    : reputationScopesFor(world, victimId, offense);

  const records = [];
  for (const scope of scopes) {
    const rec = upsertReputation(world, actorId, scope.scopeKind, scope.scopeKey, {
      delta,
      severity,
      offenseKind,
      witnessCount,
      turn,
    });
    if (rec) records.push(rec);
  }

  const event = Object.freeze({
    actorId,
    victimId,
    offense: Object.freeze({ ...offense, offenseKind, severity }),
    witnessIds: Object.freeze(witnessIds),
    records: Object.freeze(records),
  });
  emitSafe(world, "reputation:changed", event);
  return event;
}

export function shopReputationTerms(world, spec = {}) {
  const actorId = normId(spec.actorId ?? spec.actor);
  const buyMarkup = Number(spec.buyMarkup ?? 1.0);
  const sellDiscount = Number(spec.sellDiscount ?? 0.5);
  const shopkeeperRep = getReputationRecord(world, actorId, "faction", "shopkeeper");
  const townRep = getReputationRecord(world, actorId, "town", "overworld");
  const worstScore = Math.min(Number(shopkeeperRep?.score || 0), Number(townRep?.score || 0));
  const band = reputationBand(worstScore);

  let buyMultiplier = 1.0;
  let sellMultiplier = 1.0;
  if (band === REPUTATION_BANDS.suspect) {
    buyMultiplier = 1.05;
    sellMultiplier = 0.95;
  } else if (band === REPUTATION_BANDS.notorious) {
    buyMultiplier = 1.15;
    sellMultiplier = 0.85;
  } else if (band === REPUTATION_BANDS.wanted) {
    buyMultiplier = 1.35;
    sellMultiplier = 0.65;
  } else if (band === REPUTATION_BANDS.infamous) {
    buyMultiplier = 1.75;
    sellMultiplier = 0.4;
  }

  return Object.freeze({
    buyMarkup: Math.max(0.1, buyMarkup * buyMultiplier),
    sellDiscount: Math.max(0, Math.min(1, sellDiscount * sellMultiplier)),
    band,
    shopkeeperReputation: shopkeeperRep,
    townReputation: townRep,
  });
}

export function installReputationOffenseListeners(world) {
  if (world[INSTALLED]) return;
  world[INSTALLED] = true;

  world.on("disposition:changed", (ev = {}) => {
    applyOffenseReputation(world, {
      actorId: ev.actorId,
      victimId: ev.victimId,
      offense: ev.offense,
      witnessIds: ev.witnessIds || [],
      severity: ev.offense?.severity,
      offenseKind: ev.offense?.offenseKind,
    });
  });
}
