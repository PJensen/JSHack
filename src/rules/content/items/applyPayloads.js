import { Inventory } from "../../components/Inventory.js";
import { ItemInfo } from "../../components/ItemInfo.js";
import { NamedIdentity } from "../../components/NamedIdentity.js";
import { getItemHooksByIdentity } from "./itemHooks.js";

/**
 * @typedef {{
 *   actor: number,
 *   toolId: number,
 *   targetId: number,
 *   toolIdentity: string,
 *   targetIdentity: string,
 *   toolInfo: any,
 *   targetInfo: any,
 * }} ApplyPayloadState
 */

/**
 * @typedef {{
 *   id: string,
 *   matches: (state: ApplyPayloadState) => boolean,
 *   beforeApply?: (ctx: any, state: ApplyPayloadState) => unknown,
 *   onApply?: (ctx: any, state: ApplyPayloadState) => unknown,
 *   afterApply?: (ctx: any, state: ApplyPayloadState) => unknown,
 * }} ApplyPayloadDef
 */

/**
 * Reserved for cross-item matcher payloads only.
 * Item-specific apply behavior should live on item-def hooks.
 * @type {ApplyPayloadDef[]}
 */
export const APPLY_PAYLOADS = Object.freeze([]);

/**
 * @param {{
 *   identity: (entityId: number) => string,
 *   itemInfo: (entityId: number) => any,
 * }} reader
 * @param {{ actor: number, toolId: number, targetId: number }} spec
 * @returns {ApplyPayloadState}
 */
export function buildApplyPayloadState(reader, spec) {
  const actor = spec?.actor | 0;
  const toolId = spec?.toolId | 0;
  const targetId = spec?.targetId | 0;
  return {
    actor,
    toolId,
    targetId,
    toolIdentity: String(reader?.identity?.(toolId) || "").toLowerCase(),
    targetIdentity: String(reader?.identity?.(targetId) || "").toLowerCase(),
    toolInfo: reader?.itemInfo?.(toolId),
    targetInfo: reader?.itemInfo?.(targetId),
  };
}

/**
 * @param {ApplyPayloadState} state
 * @returns {ApplyPayloadDef | null}
 */
export function findApplyPayload(state) {
  const hooks = getItemHooksByIdentity(state?.toolIdentity || "");
  if (typeof hooks.onDip !== "function") return null;

  if (typeof hooks.canDipTarget === "function") {
    try {
      if (!hooks.canDipTarget(state)) return null;
    } catch {
      return null;
    }
  }

  return {
    id: `item:${String(state?.toolIdentity || "unknown")}:onDip`,
    matches: () => true,
    beforeApply: typeof hooks.beforeDip === "function"
      ? (ctx, nextState) => hooks.beforeDip(ctx, nextState)
      : undefined,
    onApply: (ctx, nextState) => hooks.onDip(ctx, nextState),
    afterApply: typeof hooks.afterDip === "function"
      ? (ctx, nextState) => hooks.afterDip(ctx, nextState)
      : undefined,
  };
}

/**
 * Resolve the canonical apply payload for a tool/target pair from any reader.
 * Shared by runtime pipeline and UI targetability helpers.
 *
 * @param {{
 *   identity: (entityId: number) => string,
 *   itemInfo: (entityId: number) => any,
 * }} reader
 * @param {{ actor: number, toolId: number, targetId: number }} spec
 * @returns {{ state: ApplyPayloadState, payloadDef: ApplyPayloadDef | null }}
 */
export function resolveApplyPayload(reader, spec) {
  const state = buildApplyPayloadState(reader, spec);
  const payloadDef = findApplyPayload(state);
  return { state, payloadDef };
}

/**
 * @param {import("../../../lib/ecs-js/index.js").World} world
 */
function createWorldApplyPayloadReader(world) {
  return {
    identity(entityId) {
      const ni = /** @type any */ (world.get(entityId | 0, NamedIdentity));
      return String(ni?.identity || "");
    },
    itemInfo(entityId) {
      return /** @type any */ (world.get(entityId | 0, ItemInfo));
    },
  };
}

/**
 * World-backed resolver wrapper for apply payload lookup.
 * @param {import("../../../lib/ecs-js/index.js").World} world
 * @param {{ actor: number, toolId: number, targetId: number }} spec
 */
export function resolveApplyPayloadForWorld(world, spec) {
  const reader = createWorldApplyPayloadReader(world);
  return resolveApplyPayload(reader, spec);
}

/**
 * @param {import("../../../lib/ecs-js/index.js").World} world
 * @param {number} actor
 * @param {number} toolId
 */
export function listApplyTargetsForTool(world, actor, toolId) {
  const actorId = actor | 0;
  const toolEntityId = toolId | 0;
  if (!world || !(actorId > 0) || !(toolEntityId > 0)) return [];
  if (!world.isAlive(actorId) || !world.isAlive(toolEntityId)) return [];

  const inv = /** @type any */ (world.get(actorId, Inventory));
  if (!inv || !Array.isArray(inv.items)) return [];
  if (!inv.items.includes(toolEntityId)) return [];

  const out = [];
  const reader = createWorldApplyPayloadReader(world);
  for (let i = 0; i < inv.items.length; i++) {
    const targetId = inv.items[i] | 0;
    if (!(targetId > 0) || targetId === toolEntityId) continue;
    if (!world.isAlive(targetId)) continue;

    const { payloadDef } = resolveApplyPayload(reader, {
      actor: actorId,
      toolId: toolEntityId,
      targetId,
    });
    if (payloadDef) out.push(targetId);
  }
  return out;
}

/**
 * @param {import("../../../lib/ecs-js/index.js").World} world
 * @param {number} actor
 * @param {number} toolId
 */
export function canUseApplyTool(world, actor, toolId) {
  return listApplyTargetsForTool(world, actor, toolId).length > 0;
}

/**
 * Returns true if an inventory item is an apply-capable tool, even when there
 * are currently no valid targets.
 *
 * @param {import("../../../lib/ecs-js/index.js").World} world
 * @param {number} actor
 * @param {number} toolId
 */
export function isApplyTool(world, actor, toolId) {
  const actorId = actor | 0;
  const toolEntityId = toolId | 0;
  if (!world || !(actorId > 0) || !(toolEntityId > 0)) return false;
  if (!world.isAlive(actorId) || !world.isAlive(toolEntityId)) return false;

  const inv = /** @type any */ (world.get(actorId, Inventory));
  if (!inv || !Array.isArray(inv.items)) return false;
  if (!inv.items.includes(toolEntityId)) return false;

  const reader = createWorldApplyPayloadReader(world);
  const state = buildApplyPayloadState(reader, {
    actor: actorId,
    toolId: toolEntityId,
    targetId: 0,
  });
  const hooks = getItemHooksByIdentity(state.toolIdentity);
  if (typeof hooks.onDip === "function") return true;

  return listApplyTargetsForTool(world, actorId, toolEntityId).length > 0;
}
