// rules/utils/effects.js
// Shared helper to ensure an entity has the ActiveEffects component.

import { attach } from "../../lib/ecs-js/hierarchy.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { Duration } from "../components/Duration.js";
import { Source } from "../components/Source.js";
import { StatusEffectNode } from "../components/StatusEffectNode.js";
import { TimedEffectNode } from "../components/TimedEffectNode.js";
import { upsertTimedEffect } from "./effectSemantics.js";
import { descendantsWith } from "./topology.js";

function normalizeEffectKey(value) {
  return String(value || "").trim().toLowerCase();
}

export function isInvulnerabilityEffectKey(value) {
  const key = normalizeEffectKey(value);
  return key === "invulnerable" || key === "invuln";
}

/**
 * Ensure `entityId` has an ActiveEffects component with an `effects` array.
 * If the component already exists it is returned as-is; otherwise it is added.
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} id  entity id
 * @returns {{ effects: Array<any> } | null}  the ActiveEffects component, or null on failure
 */
export function ensureActiveEffects(world, id) {
  let ae = world.get(id, ActiveEffects);
  if (ae && Array.isArray(ae.effects)) return ae;
  try { world.add(id, ActiveEffects, { effects: [] }); } catch { /* already exists */ }
  ae = world.get(id, ActiveEffects);
  return (ae && Array.isArray(ae.effects)) ? ae : null;
}

/**
 * Create a topology-backed status effect node under `actorId`.
 *
 * ActiveEffects mirroring is kept on by default for compatibility while status
 * systems migrate. The topology node is the preferred runtime identity.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} actorId
 * @param {{
 *   key:string,
 *   turnsLeft:number,
 *   maxTurns?:number,
 *   startedAtTurn?:number,
 *   potency?:number,
 *   stacks?:number,
 *   sourceId?:number,
 *   sourceKind?:string,
 *   sourceKey?:string,
 *   onsetLeft?:number,
 * }} effect
 * @param {{ mirrorLegacy?: boolean }} [opts]
 * @returns {number}
 */
export function applyStatusEffect(world, actorId, effect, opts = {}) {
  const id = Number(actorId || 0) | 0;
  const key = String(effect?.key || "").trim();
  const turnsLeft = Number(effect?.turnsLeft ?? 0) | 0;
  if (!(id > 0)) throw new Error("applyStatusEffect: actorId must be a positive entity id");
  if (!key) throw new Error("applyStatusEffect: effect.key is required");
  if (!(turnsLeft >= 0)) throw new Error("applyStatusEffect: turnsLeft must be >= 0");

  const potency = Number.isFinite(effect?.potency) ? Number(effect.potency) : 1;
  const stacks = Number.isInteger(effect?.stacks) && effect.stacks > 0 ? effect.stacks : 1;
  const normalizedKey = normalizeEffectKey(key);
  let nodeId = 0;

  for (const [candidateId, node] of descendantsWith(world, id, StatusEffectNode)) {
    if (normalizeEffectKey(node?.key) !== normalizedKey) continue;
    nodeId = candidateId;
    break;
  }

  if (!(nodeId > 0)) {
    nodeId = world.create();
    attach(world, nodeId, id);
  }

  const existingStatus = world.get(nodeId, StatusEffectNode);
  const existingDuration = world.get(nodeId, Duration);
  const nextStatus = {
    key,
    potency: Math.max(Number(existingStatus?.potency || 0), potency),
    stacks: existingStatus
      ? Math.max(1, Number(existingStatus.stacks || 0) | 0) + stacks
      : stacks,
  };
  const nextDuration = {
    turnsLeft,
    onsetLeft: Number(effect?.onsetLeft ?? 0) | 0,
    maxTurns: Number(effect?.maxTurns ?? turnsLeft) | 0,
    startedAtTurn: Number(effect?.startedAtTurn ?? 0) | 0,
  };
  if (existingDuration) {
    nextDuration.turnsLeft = Math.max(Number(existingDuration.turnsLeft || 0) | 0, nextDuration.turnsLeft);
    nextDuration.onsetLeft = Math.min(
      Math.max(0, Number(existingDuration.onsetLeft || 0) | 0),
      Math.max(0, nextDuration.onsetLeft),
    );
    nextDuration.maxTurns = Math.max(Number(existingDuration.maxTurns || 0) | 0, nextDuration.maxTurns);
    nextDuration.startedAtTurn = Number.isFinite(existingDuration.startedAtTurn)
      ? (Number(existingDuration.startedAtTurn) | 0)
      : nextDuration.startedAtTurn;
  }

  if (existingStatus) world.set(nodeId, StatusEffectNode, nextStatus);
  else world.add(nodeId, StatusEffectNode, nextStatus);

  if (world.has(nodeId, TimedEffectNode)) world.set(nodeId, TimedEffectNode, { key });
  else world.add(nodeId, TimedEffectNode, { key });

  if (existingDuration) world.set(nodeId, Duration, nextDuration);
  else world.add(nodeId, Duration, nextDuration);

  if (effect?.sourceId != null || effect?.sourceKind || effect?.sourceKey) {
    world.add(nodeId, Source, {
      kind: String(effect?.sourceKind || ""),
      id: Number(effect?.sourceId || 0) | 0,
      key: String(effect?.sourceKey || ""),
    });
  }

  if (opts.mirrorLegacy !== false) {
    const ae = ensureActiveEffects(world, id);
    if (ae) {
      upsertTimedEffect(ae.effects, { ...effect, key, turnsLeft, potency, stacks });
    }
  }

  return nodeId;
}
