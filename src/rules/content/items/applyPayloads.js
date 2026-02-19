import { getGem } from "../../data/gems.js";
import { identify } from "../../data/identification.js";

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
  return null;
}
