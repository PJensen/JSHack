import { Beatitude } from "../components/Beatitude.js";
import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Material } from "../components/Material.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Position } from "../components/Position.js";
import { MATERIAL_REACTION_RULES } from "../data/materialReactions.js";
import { hasAnyStatus } from "../utils/statusFacade.js";
import { inventoryItems } from "../utils/inventoryFacade.js";

const SEEN_KEY = Symbol.for("jshack:materialReactions:seenPerStep");
const INSTALLED_KEY = Symbol.for("jshack:materialReactions:listeners:installed");
const EVENT_QUEUE_KEY = Symbol.for("jshack:materialReactions:eventQueue");
const EVENT_SEQ_KEY = Symbol.for("jshack:materialReactions:eventSeq");

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
function ensureSeenState(world) {
  const rec = world[SEEN_KEY];
  if (rec && typeof rec === "object" && rec.ids instanceof Set) return rec;
  const created = { step: -1, ids: new Set() };
  world[SEEN_KEY] = created;
  return created;
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
function ensureEventQueue(world) {
  if (!Array.isArray(world[EVENT_QUEUE_KEY])) world[EVENT_QUEUE_KEY] = [];
  return world[EVENT_QUEUE_KEY];
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
function nextEventSeq(world) {
  const next = (Number(world[EVENT_SEQ_KEY] || 0) | 0) + 1;
  world[EVENT_SEQ_KEY] = next;
  return next;
}

function trackedReactionEvents() {
  const set = new Set();
  for (let i = 0; i < MATERIAL_REACTION_RULES.length; i++) {
    const events = Array.isArray(MATERIAL_REACTION_RULES[i]?.sourceEvents)
      ? MATERIAL_REACTION_RULES[i].sourceEvents
      : [];
    for (let j = 0; j < events.length; j++) {
      const eventName = String(events[j] || "").trim();
      if (eventName) set.add(eventName);
    }
  }
  return Array.from(set);
}

/**
 * Install material reaction event listeners. Call once per world in configureWorld().
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function installMaterialReactionListeners(world) {
  if (!world || world[INSTALLED_KEY]) return;
  world[INSTALLED_KEY] = true;
  const queue = ensureEventQueue(world);
  const trackedEvents = trackedReactionEvents();

  for (let i = 0; i < trackedEvents.length; i++) {
    const eventName = trackedEvents[i];
    world.on(eventName, (payload = {}) => {
      const safePayload = (payload && typeof payload === "object") ? { ...payload } : {};
      queue.push({
        id: nextEventSeq(world),
        kind: eventName,
        payload: safePayload,
      });
    });
  }
}

/**
 * @param {any} point
 */
function toPoint(point) {
  if (!point || typeof point !== "object") return null;
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: x | 0, y: y | 0 };
}

/**
 * @param {any} payload
 */
function eventSourceId(payload) {
  const candidate = Number(payload?.sourceId ?? payload?.actor ?? payload?.source ?? payload?.who ?? 0);
  return Number.isFinite(candidate) ? (candidate | 0) : 0;
}

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {any} payload
 * @param {number} sourceId
 */
function eventSourcePos(world, payload, sourceId) {
  const direct = toPoint(payload?.at) || toPoint(payload?.pos);
  if (direct) return direct;
  if (!(sourceId > 0)) return null;
  const pos = world.get(sourceId, Position);
  if (!pos) return null;
  return { x: pos.x | 0, y: pos.y | 0 };
}

/**
 * @param {any} payload
 */
function eventTargetIds(payload) {
  const ids = new Set();
  const candidates = [
    Number(payload?.targetId || 0) | 0,
    Number(payload?.targetItemId || 0) | 0,
    Number(payload?.itemTargetId || 0) | 0,
  ];
  for (let i = 0; i < candidates.length; i++) {
    const id = candidates[i];
    if (id > 0) ids.add(id);
  }
  return Array.from(ids);
}

function transmuteToAsh(world, id, info, mat) {
  const ni = world.get(id, NamedIdentity);
  if (ni) {
    ni.name = "Ash";
    ni.identity = "ash";
  } else {
    world.add(id, NamedIdentity, { name: "Ash", identity: "ash" });
  }

  info.type = "junk";
  info.slot = "bag";
  info.description = "A small pile of ash.";
  info.weight = 0.05;
  info.value = 0;
  info.count = Math.max(1, Number(info.count || 1) | 0);
  info.affixes = [];
  info.bonuses = {};
  info.damageDice = null;
  info.staminaCost = null;
  info.subtype = null;
  info.range = null;
  info.rarity = 1;
  info.rarityName = "common";

  if (mat) mat.kind = "sand";
  else world.add(id, Material, { kind: "sand" });
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} itemId
 * @param {any} info
 * @param {any} mat
 */
function snapshotItemState(world, itemId, info, mat) {
  const ni = world.get(itemId, NamedIdentity);
  const beat = world.get(itemId, Beatitude);
  const fallbackName = info?.description || info?.type || `item ${itemId}`;
  return {
    name: String(ni?.name || fallbackName),
    identity: String(ni?.identity || ""),
    type: String(info?.type || ""),
    material: String(mat?.kind || ""),
    beatitude: String(beat?.state || "uncursed"),
  };
}

/**
 * @param {{
 *   itemId: number,
 *   ownerId: number | null,
 *   scope: "inventory" | "ground" | "target",
 *   sourceId: number,
 *   sourcePos: {x:number,y:number},
 *   rule: { id: string, eventKind: string },
 *   reaction: { id: string, result?: string },
 *   from: { name: string, identity: string, type: string, material: string, beatitude: string },
 *   to: { name: string, identity: string, type: string, material: string, beatitude: string },
 * }} spec
 */
function createItemTransformedEvent(spec) {
  return Object.freeze({
    itemId: Number(spec.itemId || 0) | 0,
    ownerId: Number.isInteger(spec.ownerId) && spec.ownerId > 0 ? (spec.ownerId | 0) : null,
    scope: spec.scope === "inventory" ? "inventory" : (spec.scope === "target" ? "target" : "ground"),
    source: Number(spec.sourceId || 0) | 0,
    cause: String(spec.rule?.eventKind || "unknown"),
    rule: String(spec.rule?.id || ""),
    reaction: String(spec.reaction?.id || ""),
    at: { x: spec.sourcePos.x | 0, y: spec.sourcePos.y | 0 },
    from: spec.from,
    to: spec.to,
    result: String(spec.reaction?.result || "changed"),
  });
}

/**
 * @param {{
 *   itemId: number,
 *   ownerId: number | null,
 *   scope: "inventory" | "ground" | "target",
 *   sourceId: number,
 *   sourcePos: {x:number,y:number},
 *   rule: { id: string, eventKind: string },
 *   reaction: { id: string, result?: string },
 *   result?: string,
 * }} spec
 */
function createItemReactedEvent(spec) {
  return Object.freeze({
    itemId: Number(spec.itemId || 0) | 0,
    ownerId: Number.isInteger(spec.ownerId) && spec.ownerId > 0 ? (spec.ownerId | 0) : null,
    scope: spec.scope === "inventory" ? "inventory" : (spec.scope === "target" ? "target" : "ground"),
    source: Number(spec.sourceId || 0) | 0,
    cause: String(spec.rule?.eventKind || "unknown"),
    rule: String(spec.rule?.id || ""),
    reaction: String(spec.reaction?.id || ""),
    at: { x: spec.sourcePos.x | 0, y: spec.sourcePos.y | 0 },
    result: String(spec.result || spec.reaction?.result || "reacted"),
  });
}

/**
 * @param {any} info
 * @param {any} mat
 * @param {string} identity
 * @param {{ itemTypes?: string[], materials?: string[], identities?: string[] }} match
 * @param {{ waterType?: string } | null} sourcePayload
 * @param {{ waterTypes?: string[] }} reaction
 */
function matchesReaction(info, mat, identity, match, sourcePayload, reaction) {
  if (!match || typeof match !== "object") return false;

  const type = String(info?.type || "").toLowerCase();
  const kind = String(mat?.kind || "").toLowerCase();
  const normalizedIdentity = String(identity || "").toLowerCase();

  const itemTypes = Array.isArray(match.itemTypes)
    ? match.itemTypes.map((v) => String(v || "").toLowerCase()).filter(Boolean)
    : [];
  const materials = Array.isArray(match.materials)
    ? match.materials.map((v) => String(v || "").toLowerCase()).filter(Boolean)
    : [];
  const identities = Array.isArray(match.identities)
    ? match.identities.map((v) => String(v || "").toLowerCase()).filter(Boolean)
    : [];

  if (itemTypes.length > 0 && !itemTypes.includes(type)) return false;
  if (materials.length > 0 && !materials.includes(kind)) return false;
  if (identities.length > 0 && !identities.includes(normalizedIdentity)) return false;

  const waterTypes = Array.isArray(reaction?.waterTypes)
    ? reaction.waterTypes.map((v) => String(v || "").toLowerCase()).filter(Boolean)
    : [];
  if (waterTypes.length > 0) {
    const waterType = String(sourcePayload?.waterType || "").toLowerCase();
    if (!waterTypes.includes(waterType)) return false;
  }

  return itemTypes.length > 0 || materials.length > 0 || identities.length > 0;
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} itemId
 * @param {any} info
 * @param {any} mat
 * @param {any} reaction
 * @param {{ waterType?: string, actor?: number, itemId?: number, toolId?: number } | null} sourcePayload
 * @param {number} sourceId
 */
function applyReactionOutcome(world, itemId, info, mat, reaction, sourcePayload, sourceId) {
  const outcome = String(reaction?.outcome || "");
  if (outcome === "transmute_to_ash") {
    transmuteToAsh(world, itemId, info, mat);
    return { applied: true, transformed: true, result: String(reaction?.result || "ash") };
  }

  if (outcome === "set_beatitude") {
    const state = String(reaction?.state || "").toLowerCase();
    if (state !== "blessed" && state !== "uncursed" && state !== "cursed") {
      return { applied: false, transformed: false, result: "invalid" };
    }
    let beat = world.get(itemId, Beatitude);
    if (beat && String(beat.state || "").toLowerCase() === state) {
      return { applied: false, transformed: false, result: state };
    }
    if (!beat) {
      world.add(itemId, Beatitude, { state });
      beat = world.get(itemId, Beatitude);
    }
    if (beat) beat.state = state;
    return { applied: true, transformed: false, result: String(reaction?.result || state) };
  }

  if (outcome === "emit_waterlogged") {
    try {
      world.emit?.("item:waterlogged", {
        actor: Number(sourcePayload?.actor || sourceId || 0) | 0,
        itemId: itemId | 0,
        by: Number(sourcePayload?.toolId || sourcePayload?.itemId || 0) | 0,
        waterType: String(sourcePayload?.waterType || ""),
      });
    } catch { /* */ }
    return { applied: true, transformed: false, result: String(reaction?.result || "waterlogged") };
  }

  return { applied: false, transformed: false, result: "none" };
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {{
 *   itemId: number,
 *   info: any,
 *   mat: any,
 *   sourceId: number,
 *   sourcePos: {x:number,y:number},
 *   seen: Set<string|number>,
 *   rule: any,
 *   scope: "inventory"|"ground"|"target",
 *   ownerId: number|null,
 *   sourcePayload: any,
 *   seenKey: string,
 * }} spec
 */
function reactItem(world, spec) {
  const {
    itemId,
    info,
    mat,
    sourceId,
    sourcePos,
    seen,
    rule,
    scope,
    ownerId,
    sourcePayload,
    seenKey,
  } = spec;

  if (!(itemId > 0) || !world.isAlive(itemId)) return false;
  if (seen.has(seenKey)) return false;

  const ni = world.get(itemId, NamedIdentity);
  const identity = String(ni?.identity || "");

  for (let i = 0; i < rule.reactions.length; i++) {
    const reaction = rule.reactions[i];
    if (!matchesReaction(info, mat, identity, reaction.match, sourcePayload, reaction)) continue;

    const from = snapshotItemState(world, itemId, info, mat);
    const out = applyReactionOutcome(world, itemId, info, mat, reaction, sourcePayload, sourceId);
    if (!out.applied) continue;
    const to = snapshotItemState(world, itemId, info, mat);

    seen.add(seenKey);
    try {
      if (out.transformed) {
        world.emit?.("item:transformed", createItemTransformedEvent({
          itemId,
          ownerId,
          scope,
          sourceId,
          sourcePos,
          rule,
          reaction,
          from,
          to,
        }));
      } else {
        world.emit?.("item:reacted", createItemReactedEvent({
          itemId,
          ownerId,
          scope,
          sourceId,
          sourcePos,
          rule,
          reaction,
          result: out.result,
        }));
      }
    } catch { /* */ }
    return true;
  }

  return false;
}

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {Set<string|number>} seen
 * @param {any} rule
 * @param {number} sourceId
 * @param {{x:number,y:number}|null} sourcePos
 * @param {any} sourcePayload
 * @param {string} seenSalt
 */
function runRuleAgainstSource(world, seen, rule, sourceId, sourcePos, sourcePayload, seenSalt) {
  for (let s = 0; s < rule.itemScopes.length; s++) {
    const scope = rule.itemScopes[s];

    if (scope === "ground") {
      if (!sourcePos) continue;
      for (const [itemId, itemPos, info] of world.query(Position, ItemInfo)) {
        if (itemPos.x !== sourcePos.x || itemPos.y !== sourcePos.y) continue;
        const mat = world.get(itemId, Material);
        reactItem(world, {
          itemId,
          info,
          mat,
          sourceId,
          sourcePos,
          seen,
          rule,
          scope: "ground",
          ownerId: null,
          sourcePayload,
          seenKey: `${rule.id}:ground:${itemId}:${seenSalt}`,
        });
      }
      continue;
    }

    if (scope === "inventory") {
      if (!(sourceId > 0)) continue;
      for (const itemId of inventoryItems(world, sourceId)) {
        if (!(itemId > 0) || !world.isAlive(itemId)) continue;
        const info = world.get(itemId, ItemInfo);
        if (!info) continue;
        const mat = world.get(itemId, Material);
        reactItem(world, {
          itemId,
          info,
          mat,
          sourceId,
          sourcePos: sourcePos || { x: 0, y: 0 },
          seen,
          rule,
          scope: "inventory",
          ownerId: sourceId,
          sourcePayload,
          seenKey: `${rule.id}:inventory:${itemId}:${seenSalt}`,
        });
      }
      continue;
    }

    if (scope === "target") {
      const targetIds = eventTargetIds(sourcePayload);
      if (targetIds.length <= 0) continue;
      for (let i = 0; i < targetIds.length; i++) {
        const itemId = targetIds[i] | 0;
        if (!(itemId > 0) || !world.isAlive(itemId)) continue;
        const info = world.get(itemId, ItemInfo);
        if (!info) continue;
        const mat = world.get(itemId, Material);
        reactItem(world, {
          itemId,
          info,
          mat,
          sourceId,
          sourcePos: sourcePos || { x: 0, y: 0 },
          seen,
          rule,
          scope: "target",
          ownerId: null,
          sourcePayload,
          seenKey: `${rule.id}:target:${itemId}:${seenSalt}`,
        });
      }
    }
  }
}

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {Set<string|number>} seen
 */
function processStatusDrivenRules(world, seen) {
  for (const [sourceId, sourcePos] of world.query(Position)) {
    for (let r = 0; r < MATERIAL_REACTION_RULES.length; r++) {
      const rule = MATERIAL_REACTION_RULES[r];
      if (!Array.isArray(rule.sourceStatuses) || rule.sourceStatuses.length <= 0) continue;
      if (!hasAnyStatus(world, sourceId, rule.sourceStatuses)) continue;
      runRuleAgainstSource(world, seen, rule, sourceId, { x: sourcePos.x | 0, y: sourcePos.y | 0 }, null, "status");
    }
  }
}

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {Set<string|number>} seen
 */
function processEventDrivenRules(world, seen) {
  const queue = ensureEventQueue(world);
  if (queue.length <= 0) return;
  const pending = queue.splice(0, queue.length);

  for (let e = 0; e < pending.length; e++) {
    const ev = pending[e];
    const eventKind = String(ev?.kind || "");
    if (!eventKind) continue;
    const sourcePayload = (ev?.payload && typeof ev.payload === "object") ? ev.payload : {};
    const sourceId = eventSourceId(sourcePayload);
    const sourcePos = eventSourcePos(world, sourcePayload, sourceId);

    for (let r = 0; r < MATERIAL_REACTION_RULES.length; r++) {
      const rule = MATERIAL_REACTION_RULES[r];
      const sourceEvents = Array.isArray(rule.sourceEvents) ? rule.sourceEvents : [];
      if (!sourceEvents.includes(eventKind)) continue;
      runRuleAgainstSource(
        world,
        seen,
        rule,
        sourceId,
        sourcePos,
        sourcePayload,
        `ev${Number(ev?.id || 0) | 0}`,
      );
    }
  }
}

/**
 * Effects-phase material reaction pass.
 * Uses semantic status and event state instead of source-specific system wiring.
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function materialReactionSystem(world) {
  const seenState = ensureSeenState(world);
  const step = world.step | 0;
  if (seenState.step !== step) {
    seenState.step = step;
    seenState.ids.clear();
  }
  const seen = seenState.ids;

  processStatusDrivenRules(world, seen);
  processEventDrivenRules(world, seen);
}
