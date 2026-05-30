import { attach, detach } from "../../lib/ecs-js/hierarchy.js";
import { ThreatEntry } from "../components/ThreatEntry.js";
import { AggroState } from "../components/AggroState.js";
import { Equipment, NON_AMMO_GEAR_SLOTS } from "../components/Equipment.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Position } from "../components/Position.js";
import { childrenWith } from "./topology.js";
import { setAggroTarget } from "./aggroTarget.js";
import { chebyshevScalar } from "./distance.js";

export const THREAT_SWITCH_MELEE_MULT = 1.10;
export const THREAT_SWITCH_RANGED_MULT = 1.30;
export const THREAT_TAUNT_MARGIN = 5;
export const THREAT_SOFT_TAUNT_BURST = 6;
export const THREAT_MIN_GENERATION_MULT = 0.25;
export const THREAT_MAX_GENERATION_MULT = 2.5;

function readTurn(world) {
  return Math.max(0, Number(world?.step || 0) | 0);
}

function normalizeId(value) {
  const id = Number(value || 0) | 0;
  return id > 0 ? id : 0;
}

function destroyThreatEntry(world, entryId) {
  const id = normalizeId(entryId);
  if (!id || !world?.isAlive?.(id)) return false;
  try { detach(world, id, { remove: true }); } catch {}
  world.destroy(id);
  return true;
}

export function getThreatEntries(world, ownerId) {
  const out = [];
  const owner = normalizeId(ownerId);
  if (!owner || !world?.isAlive?.(owner)) return out;
  for (const [entryId, entry] of childrenWith(world, owner, ThreatEntry)) {
    out.push([entryId, entry]);
  }
  return out;
}

export function findThreatEntry(world, ownerId, sourceId) {
  const source = normalizeId(sourceId);
  if (!source) return null;
  for (const [entryId, entry] of getThreatEntries(world, ownerId)) {
    if ((Number(entry.sourceId || 0) | 0) === source) return [entryId, entry];
  }
  return null;
}

export function getThreatValue(world, ownerId, sourceId) {
  const found = findThreatEntry(world, ownerId, sourceId);
  return found ? Math.max(0, Number(found[1].value || 0) | 0) : 0;
}

export function getHighestThreat(world, ownerId) {
  let bestId = 0;
  let bestValue = 0;
  let bestEntryId = 0;
  for (const [entryId, entry] of getThreatEntries(world, ownerId)) {
    const sourceId = normalizeId(entry.sourceId);
    const value = Math.max(0, Number(entry.value || 0) | 0);
    if (!sourceId || !world.isAlive(sourceId) || value <= 0) continue;
    if (value > bestValue || (value === bestValue && sourceId < bestId)) {
      bestId = sourceId;
      bestValue = value;
      bestEntryId = entryId;
    }
  }
  return { sourceId: bestId, value: bestValue, entryId: bestEntryId };
}

export function addThreat(world, ownerId, sourceId, amount, opts = {}) {
  const owner = normalizeId(ownerId);
  const source = normalizeId(sourceId);
  const delta = Math.max(0, Number(amount || 0) | 0);
  if (!owner || !source || owner === source || delta <= 0) return null;
  if (!world?.isAlive?.(owner) || !world.isAlive(source)) return null;
  if (!world.get(owner, AggroState)) return null;

  let found = findThreatEntry(world, owner, source);
  if (!found) {
    const entryId = world.create();
    world.add(entryId, ThreatEntry, {
      sourceId: source,
      value: 0,
      lastTurnTouched: readTurn(world),
      kind: String(opts.kind || ""),
      forcedUntilTurn: 0,
      decayRate: Math.max(1, Number(opts.decayRate || 2) | 0),
      sticky: !!opts.sticky,
    });
    attach(world, entryId, owner);
    found = [entryId, world.get(entryId, ThreatEntry)];
  }

  const entry = found[1];
  entry.value = Math.max(0, (Number(entry.value || 0) | 0) + delta);
  entry.lastTurnTouched = readTurn(world);
  entry.kind = String(opts.kind || entry.kind || "");
  entry.decayRate = Math.max(1, Number(opts.decayRate || entry.decayRate || 2) | 0);
  entry.sticky = !!(opts.sticky || entry.sticky);
  return found;
}

export function reduceThreat(world, ownerId, sourceId, amount, opts = {}) {
  const found = findThreatEntry(world, ownerId, sourceId);
  if (!found) return 0;
  const entry = found[1];
  const before = Math.max(0, Number(entry.value || 0) | 0);
  const flat = Math.max(0, Number(amount || 0) | 0);
  const pct = Math.max(0, Math.min(1, Number(opts.percent || opts.pct || 0)));
  const next = Math.max(0, Math.floor((before - flat) * (1 - pct)));
  entry.value = next;
  entry.lastTurnTouched = readTurn(world);
  if (next <= 0) {
    destroyThreatEntry(world, found[0]);
  }
  return before - next;
}

export function clearThreatFromSource(world, sourceId, opts = {}) {
  const source = normalizeId(sourceId);
  if (!source) return 0;
  let changed = 0;
  for (const [ownerId, aggro] of world.query(AggroState)) {
    const found = findThreatEntry(world, ownerId, source);
    if (!found) continue;
    const before = Math.max(0, Number(found[1].value || 0) | 0);
    if (opts.destroy === false) found[1].value = 0;
    destroyThreatEntry(world, found[0]);
    changed += before;
    if ((Number(aggro.targetId || 0) | 0) === source) {
      setAggroTarget(world, ownerId, aggro, 0, String(opts.reason || "threat_drop"));
    }
    if ((Number(aggro.highestThreatId || 0) | 0) === source) aggro.highestThreatId = 0;
    if ((Number(aggro.forcedTargetId || 0) | 0) === source) {
      aggro.forcedTargetId = 0;
      aggro.forcedUntilTurn = 0;
    }
  }
  return changed;
}

export function reduceThreatFromSource(world, sourceId, opts = {}) {
  const source = normalizeId(sourceId);
  if (!source) return 0;
  let changed = 0;
  for (const [ownerId] of world.query(AggroState)) {
    changed += reduceThreat(world, ownerId, source, opts.amount || 0, opts);
    resolveThreatTarget(world, ownerId, { reason: String(opts.reason || "threat_drop") });
  }
  return changed;
}

export function getThreatGenerationMultiplier(world, sourceId) {
  const source = normalizeId(sourceId);
  if (!source || !world?.isAlive?.(source)) return 1;
  let mult = 1;
  const eq = world.get(source, Equipment);
  if (!eq) return mult;

  for (const slot of NON_AMMO_GEAR_SLOTS) {
    const itemId = normalizeId(eq[slot]);
    if (!itemId || !world.isAlive(itemId)) continue;
    const info = world.get(itemId, ItemInfo);
    if (!info) continue;
    const bonuses = info.bonuses && typeof info.bonuses === "object" ? info.bonuses : {};
    if (Number.isFinite(Number(bonuses.threatGenerationMult))) {
      mult *= Number(bonuses.threatGenerationMult);
    }
    if (Number.isFinite(Number(bonuses.threatMult))) {
      mult *= Number(bonuses.threatMult);
    }
    if (Number.isFinite(Number(bonuses.threatReduction))) {
      mult *= Math.max(0, 1 - Number(bonuses.threatReduction));
    }
    const tags = Array.isArray(info.tags) ? info.tags : [];
    for (let i = 0; i < tags.length; i++) {
      const tag = String(tags[i] || "").trim().toLowerCase();
      if (tag === "subtle" || tag === "silent" || tag === "threat_reduction") mult *= 0.75;
      else if (tag === "menacing" || tag === "threat_boost") mult *= 1.25;
    }
  }

  return Math.max(THREAT_MIN_GENERATION_MULT, Math.min(THREAT_MAX_GENERATION_MULT, mult));
}

export function forceThreatTarget(world, ownerId, sourceId, turns, opts = {}) {
  const owner = normalizeId(ownerId);
  const source = normalizeId(sourceId);
  if (!owner || !source || !world?.isAlive?.(owner) || !world.isAlive(source)) return false;
  const aggro = world.get(owner, AggroState);
  if (!aggro) return false;

  const currentTop = getHighestThreat(world, owner);
  const currentTargetThreat = getThreatValue(world, owner, aggro.targetId);
  const margin = Math.max(1, Number(opts.margin || THREAT_TAUNT_MARGIN) | 0);
  const floor = Math.max(currentTop.value, currentTargetThreat) + margin;
  const found = addThreat(world, owner, source, 1, {
    kind: String(opts.kind || "taunt"),
    decayRate: 1,
    sticky: true,
  });
  if (!found) return false;
  const entry = found[1];
  entry.value = Math.max(Number(entry.value || 0) | 0, floor);
  entry.forcedUntilTurn = readTurn(world) + Math.max(1, Number(turns || 0) | 0);

  aggro.forcedTargetId = source;
  aggro.forcedUntilTurn = entry.forcedUntilTurn;
  aggro.threatLockUntilTurn = entry.forcedUntilTurn;
  resolveThreatTarget(world, owner, { reason: String(opts.reason || "taunt"), force: true });
  return true;
}

export function decayThreat(world, ownerId) {
  const owner = normalizeId(ownerId);
  const aggro = world.get(owner, AggroState);
  if (!owner || !aggro) return 0;

  const turn = readTurn(world);
  let removed = 0;
  for (const [entryId, entry] of getThreatEntries(world, owner)) {
    const sourceId = normalizeId(entry.sourceId);
    if (!sourceId || !world.isAlive(sourceId)) {
      destroyThreatEntry(world, entryId);
      removed++;
      continue;
    }

    const forcedUntil = Math.max(0, Number(entry.forcedUntilTurn || 0) | 0);
    if (forcedUntil > turn) continue;

    let decay = sourceId === (Number(aggro.targetId || 0) | 0) ? 1 : Math.max(1, Number(entry.decayRate || 2) | 0);
    if (String(aggro.alertLevel || "") !== "hunting") decay += 3;
    entry.value = Math.max(0, (Number(entry.value || 0) | 0) - decay);
    if (entry.value <= 0) {
      destroyThreatEntry(world, entryId);
      removed++;
    }
  }
  return removed;
}

function isMeleeChallenger(world, ownerId, sourceId) {
  const ownerPos = world.get(ownerId, Position);
  const sourcePos = world.get(sourceId, Position);
  if (!ownerPos || !sourcePos) return false;
  return chebyshevScalar(ownerPos.x, ownerPos.y, sourcePos.x, sourcePos.y) <= 1;
}

export function resolveThreatTarget(world, ownerId, opts = {}) {
  const owner = normalizeId(ownerId);
  const aggro = world.get(owner, AggroState);
  if (!owner || !aggro) return 0;

  const turn = readTurn(world);
  const previousForcedTarget = normalizeId(aggro.forcedTargetId);
  if (previousForcedTarget && (Number(aggro.forcedUntilTurn || 0) | 0) <= turn) {
    const forcedEntry = findThreatEntry(world, owner, previousForcedTarget);
    if (forcedEntry) {
      let bestOther = 0;
      for (const [, entry] of getThreatEntries(world, owner)) {
        const sourceId = normalizeId(entry.sourceId);
        if (!sourceId || sourceId === previousForcedTarget || !world.isAlive(sourceId)) continue;
        bestOther = Math.max(bestOther, Number(entry.value || 0) | 0);
      }
      forcedEntry[1].value = Math.min(Number(forcedEntry[1].value || 0) | 0, Math.max(0, Math.ceil(bestOther * 0.5)));
      forcedEntry[1].forcedUntilTurn = 0;
    }
    aggro.forcedTargetId = 0;
    aggro.forcedUntilTurn = 0;
  }

  const forcedTarget = normalizeId(aggro.forcedTargetId);
  if (forcedTarget && world.isAlive(forcedTarget) && (Number(aggro.forcedUntilTurn || 0) | 0) > turn) {
    aggro.highestThreatId = getHighestThreat(world, owner).sourceId;
    aggro.threatState = "locked";
    setAggroTarget(world, owner, aggro, forcedTarget, String(opts.reason || "taunt"));
    return forcedTarget;
  }

  const top = getHighestThreat(world, owner);
  aggro.highestThreatId = top.sourceId;
  if (!top.sourceId) {
    aggro.threatState = "none";
    return normalizeId(aggro.targetId);
  }

  const current = normalizeId(aggro.targetId);
  if (!current || !world.isAlive(current)) {
    aggro.threatState = "stable";
    aggro.lastTargetSwitchTurn = turn;
    setAggroTarget(world, owner, aggro, top.sourceId, String(opts.reason || "threat"));
    return top.sourceId;
  }

  if (current === top.sourceId) {
    aggro.threatState = "stable";
    return current;
  }

  const currentThreat = getThreatValue(world, owner, current);
  const mult = isMeleeChallenger(world, owner, top.sourceId)
    ? THREAT_SWITCH_MELEE_MULT
    : THREAT_SWITCH_RANGED_MULT;
  const required = Math.ceil(currentThreat * mult);
  const canSwitch = !!opts.force || top.value >= Math.max(1, required);
  aggro.threatState = canSwitch ? "stable" : "unstable";
  if (canSwitch) {
    aggro.lastTargetSwitchTurn = turn;
    aggro.threatLockUntilTurn = turn + 1;
    setAggroTarget(world, owner, aggro, top.sourceId, String(opts.reason || "threat"));
    return top.sourceId;
  }
  return current;
}
