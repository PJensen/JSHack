// rules/data/applyDefs.js
// Function-first item-apply behavior definitions.
//
// @deprecated Legacy migration shim. Use payload hooks in
// src/rules/content/items/applyPayloads.js instead.

import { Inventory } from "../components/Inventory.js";
import { getGem } from "./gems.js";
import { identify } from "./identification.js";
import { ItemApplyActionContext } from "../utils/actionContexts.js";

export const APPLY_ITEM_TYPE = Object.freeze({
  GEM: "gem",
  EQUIP: "equip",
  POTION: "potion",
});

export const APPLY_SLOT = Object.freeze({
  WEAPON: "weapon",
});

export const APPLY_TOOL_IDENTITY = Object.freeze({
  TOUCHSTONE: "stone_touchstone",
  POISON_POTION: "potion_poison",
});

export const APPLY_RESULT = Object.freeze({
  NOTHING: "nothing",
  TOUCHSTONE: "touchstone",
  POISON_COAT: "poison_coat",
});

export const APPLY_COATING_KIND = Object.freeze({
  POISON: "poison",
});

/**
 * @typedef {{
 *   id: string,
 *   canUseTool: (ctx: ItemApplyActionContext) => boolean,
 *   canTarget: (ctx: ItemApplyActionContext) => boolean,
 *   run: (ctx: ItemApplyActionContext) => (boolean | { applied?: boolean, consumedTool?: boolean }),
 * }} ApplyDef
 */

/**
 * @param {ItemApplyActionContext} ctx
 */
function isWeaponTarget(ctx) {
  const info = ctx.getItemInfo(ctx.targetId);
  return String(info?.type || "") === APPLY_ITEM_TYPE.EQUIP
    && String(info?.slot || "") === APPLY_SLOT.WEAPON;
}

/**
 * @param {ItemApplyActionContext} ctx
 */
function isGemTarget(ctx) {
  return ctx.getItemType(ctx.targetId) === APPLY_ITEM_TYPE.GEM;
}

/** @type {ApplyDef[]} */
export const APPLY_DEFS = [
  {
    id: "touchstone_identify_gem",
    canUseTool: (ctx) => ctx.getToolIdentity() === APPLY_TOOL_IDENTITY.TOUCHSTONE,
    canTarget: isGemTarget,
    run: (ctx) => {
      const actor = ctx.actorId;
      const toolId = ctx.toolId;
      const targetId = ctx.targetId;
      const identity = ctx.getTargetIdentity();
      const gem = getGem(identity);

      if (!gem) {
        ctx.emit("item:applied", { actor, toolId, targetId, result: { type: APPLY_RESULT.NOTHING } });
        return { applied: true, consumedTool: false };
      }

      const wasNew = identify(identity);
      const result = {
        type: APPLY_RESULT.TOUCHSTONE,
        gemName: gem.name,
        appearance: gem.appearance,
        hardness: gem.hardness,
        material: gem.material,
        identified: true,
        newlyIdentified: wasNew,
      };
      ctx.emit("item:applied", { actor, toolId, targetId, result });
      if (wasNew) {
        ctx.emit("item:identified", {
          actor,
          identity,
          name: gem.name,
          appearance: gem.appearance,
          category: "gem",
        });
      }
      return { applied: true, consumedTool: false };
    },
  },
  {
    id: "poison_potion_coat_weapon",
    canUseTool: (ctx) => {
      const toolType = ctx.getItemType(ctx.toolId);
      if (toolType !== APPLY_ITEM_TYPE.POTION) return false;
      return ctx.getToolIdentity() === APPLY_TOOL_IDENTITY.POISON_POTION;
    },
    canTarget: isWeaponTarget,
    run: (ctx) => {
      const targetInfo = ctx.getItemInfo(ctx.targetId);
      if (!targetInfo) return false;
      const nextCharges = Math.max(1, Number(targetInfo?.coating?.charges || 0) + 12);
      targetInfo.coating = {
        kind: APPLY_COATING_KIND.POISON,
        charges: nextCharges,
      };
      const consumedTool = ctx.consumeTool();
      ctx.emit("item:applied", {
        actor: ctx.actorId,
        toolId: ctx.toolId,
        targetId: ctx.targetId,
        result: {
          type: APPLY_RESULT.POISON_COAT,
          coating: targetInfo.coating,
        },
      });
      return { applied: true, consumedTool };
    },
  },
];

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} actor
 * @param {number} toolId
 * @param {number} targetId
 */
export function findApplyDef(world, actor, toolId, targetId) {
  const ctx = new ItemApplyActionContext({ world, actor, toolId, targetId });
  for (let i = 0; i < APPLY_DEFS.length; i++) {
    const def = APPLY_DEFS[i];
    try {
      if (!def.canUseTool(ctx)) continue;
      if (!def.canTarget(ctx)) continue;
      return def;
    } catch {}
  }
  return null;
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} actor
 * @param {number} toolId
 */
export function canUseApplyTool(world, actor, toolId) {
  const ctx = new ItemApplyActionContext({ world, actor, toolId, targetId: 0 });
  for (let i = 0; i < APPLY_DEFS.length; i++) {
    const def = APPLY_DEFS[i];
    try {
      if (def.canUseTool(ctx)) return true;
    } catch {}
  }
  return false;
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} actor
 * @param {number} toolId
 * @returns {number[]}
 */
export function listApplyTargetsForTool(world, actor, toolId) {
  const inv = /** @type any */ (world.get(actor, Inventory));
  if (!inv || !Array.isArray(inv.items)) return [];
  const out = [];
  for (let i = 0; i < inv.items.length; i++) {
    const targetId = inv.items[i];
    if (targetId === toolId) continue;
    const ctx = new ItemApplyActionContext({ world, actor, toolId, targetId });
    for (let d = 0; d < APPLY_DEFS.length; d++) {
      const def = APPLY_DEFS[d];
      try {
        if (!def.canUseTool(ctx)) continue;
        if (!def.canTarget(ctx)) continue;
        out.push(targetId);
        break;
      } catch {}
    }
  }
  return out;
}
