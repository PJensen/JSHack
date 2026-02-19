import { Inventory } from "../../components/Inventory.js";
import { ItemInfo } from "../../components/ItemInfo.js";
import { NamedIdentity } from "../../components/NamedIdentity.js";
import { getGem } from "../../data/gems.js";
import { identify } from "../../data/identification.js";
import { getItemHooksByIdentity } from "./itemHooks.js";

export const APPLY_RESULT = Object.freeze({
  NOTHING: "nothing",
  TOUCHSTONE: "touchstone",
  POISON_COAT: "poison_coat",
});

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

/** @type {ApplyPayloadDef[]} */
export const APPLY_PAYLOADS = Object.freeze([
  {
    id: "touchstone_identify_gem",
    matches: (state) => {
      if (state.toolIdentity !== "stone_touchstone") return false;
      return String(state.targetInfo?.type || "") === "gem";
    },
    onApply: (ctx, state) => {
      const gem = getGem(state.targetIdentity);
      if (!gem) {
        ctx.io.emit("item:applied", {
          actor: state.actor,
          toolId: state.toolId,
          targetId: state.targetId,
          result: { type: APPLY_RESULT.NOTHING },
        });
        return { applied: true, consumedTool: false, resultType: APPLY_RESULT.NOTHING };
      }

      const wasNew = identify(state.targetIdentity);
      const result = {
        type: APPLY_RESULT.TOUCHSTONE,
        gemName: gem.name,
        appearance: gem.appearance,
        hardness: gem.hardness,
        material: gem.material,
        identified: true,
        newlyIdentified: wasNew,
      };

      ctx.io.emit("item:applied", {
        actor: state.actor,
        toolId: state.toolId,
        targetId: state.targetId,
        result,
      });
      if (wasNew) {
        ctx.io.emit("item:identified", {
          actor: state.actor,
          identity: state.targetIdentity,
          name: gem.name,
          appearance: gem.appearance,
          category: "gem",
        });
      }

      return { applied: true, consumedTool: false, resultType: APPLY_RESULT.TOUCHSTONE };
    },
  },
  {
    id: "poison_potion_coat_weapon",
    matches: (state) => {
      if (state.toolIdentity !== "potion_poison") return false;
      const toolType = String(state.toolInfo?.type || "");
      const targetType = String(state.targetInfo?.type || "");
      const targetSlot = String(state.targetInfo?.slot || "");
      return toolType === "potion" && targetType === "equip" && targetSlot === "weapon";
    },
    onApply: (ctx, state) => {
      const targetInfo = state.targetInfo;
      if (!targetInfo) return { applied: false, consumedTool: false, resultType: APPLY_RESULT.NOTHING };
      const nextCharges = Math.max(1, Number(targetInfo?.coating?.charges || 0) + 12);
      const coating = { kind: "poison", charges: nextCharges };
      ctx.mutate.patchItemInfo(state.targetId, { coating });
      ctx.io.emit("item:applied", {
        actor: state.actor,
        toolId: state.toolId,
        targetId: state.targetId,
        result: {
          type: APPLY_RESULT.POISON_COAT,
          coating,
        },
      });
      return { applied: true, consumedTool: true, resultType: APPLY_RESULT.POISON_COAT };
    },
  },
]);

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
  for (let i = 0; i < APPLY_PAYLOADS.length; i++) {
    const def = APPLY_PAYLOADS[i];
    try {
      if (def.matches(state)) return def;
    } catch {}
  }

  const hooks = getItemHooksByIdentity(state?.toolIdentity || "");
  if (typeof hooks.onDip === "function") {
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

  return null;
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

    const state = buildApplyPayloadState(reader, {
      actor: actorId,
      toolId: toolEntityId,
      targetId,
    });
    if (findApplyPayload(state)) out.push(targetId);
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
