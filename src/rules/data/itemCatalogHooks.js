// Hook factories and utility functions shared across item catalog categories.
import { getSpell } from "./spells.js";
import { getGem } from "./gems.js";
import { identify } from "./identification.js";
import { createEatOnUseHook, createMappingOnUseHook } from "../content/items/useNativeHooks.js";
import { requiresIdentification } from "./itemAppearances.js";
import { isIdentified } from "./identification.js";
import { Beatitude } from "../components/Beatitude.js";
import { Equipment, GEAR_SLOTS } from "../components/Equipment.js";
import { ItemCooldown } from "../components/ItemCooldown.js";
import { Vitality } from "../components/Vitality.js";
import { Stamina } from "../components/Stamina.js";
import { Mana } from "../components/Mana.js";
import { createStatusEvent } from "../../shared/events/statusEvent.js";
import { getPassiveBonuses } from "../utils/passiveBonuses.js";

/**
 * @param {string} identity
 * @param {string} prefix
 */
function spellIdFromIdentity(identity, prefix) {
  const id = String(identity || "").toLowerCase();
  const p = String(prefix || "").toLowerCase();
  if (p && !id.startsWith(p)) return "";
  return id.slice(p.length);
}

/**
 * @param {{
 *   identityPrefix: string,
 *   targetMode?: "intentTarget" | "self",
 *   castEventSource?: string,
 *   consumeOnSuccess?: boolean,
 * }} opts
 */
export function createCastSpellFromIdentityHook(opts) {
  const identityPrefix = String(opts?.identityPrefix || "").toLowerCase();
  const targetMode = String(opts?.targetMode || "self") === "intentTarget" ? "intentTarget" : "self";
  const castEventSource = String(opts?.castEventSource || "");
  const consumeOnSuccess = opts?.consumeOnSuccess !== false;

  return (ctx, state) => {
    if (typeof ctx?.rules?.runSpell !== "function") return { consumed: false };
    const actor = Number(state?.actor || ctx.actor || 0) | 0;
    const spellId = spellIdFromIdentity(state?.identity || "", identityPrefix);
    if (!spellId) return { consumed: false };
    const spell = getSpell(spellId);
    if (!spell) return { consumed: false };

    const targetId = targetMode === "intentTarget"
      ? (Number(state?.intent?.targetId || actor) | 0)
      : actor;
    const intent = targetMode === "intentTarget" ? { targetId } : {};
    const tx = Number(state?.intent?.x);
    const ty = Number(state?.intent?.y);
    if (Number.isFinite(tx) && Number.isFinite(ty)) {
      intent.x = tx | 0;
      intent.y = ty | 0;
    }
    try { ctx.rules.runSpell(actor, spell, intent); } catch { return { consumed: false }; }

    const event = { actor, spellId: spell.id, targetId };
    if (castEventSource) event.source = castEventSource;
    ctx.io.emit("castSpell", event);
    return { consumed: consumeOnSuccess, spellId: spell.id };
  };
}

/**
 * @param {{
 *   identityPrefix: string,
 *   consumeOnSuccess?: boolean,
 * }} opts
 */
export function createLearnSpellFromIdentityHook(opts) {
  const identityPrefix = String(opts?.identityPrefix || "").toLowerCase();
  const consumeOnSuccess = opts?.consumeOnSuccess !== false;
  return (ctx, state) => {
    const actor = Number(state?.actor || ctx.actor || 0) | 0;
    const spellId = spellIdFromIdentity(state?.identity || "", identityPrefix);
    if (!spellId) return { consumed: false };

    const spell = getSpell(spellId);
    if (!spell) {
      ctx.io.emit("spell:learn-denied", { actor, reason: "unknown-spell", spellId });
      return { consumed: false };
    }

    const brain = ctx.query.brain(actor);
    const learned = Array.isArray(brain?.learnedSpellIds) ? brain.learnedSpellIds : [];
    if (learned.includes(spell.id)) {
      ctx.io.emit("spell:already-known", { actor, spellId: spell.id });
      return { consumed: false };
    }

    ctx.mutate.learnSpell(actor, spell.id);
    ctx.io.emit("spell:learned", { actor, spellId: spell.id });
    return { consumed: consumeOnSuccess, spellId: spell.id };
  };
}

/**
 * @param {string} title
 * @param {string} text
 */
export function createOpenFlavorBookHook(title, text) {
  const normalizedTitle = String(title || "Book");
  const normalizedText = String(text || "");
  return (ctx, state) => {
    const actor = Number(state?.actor || ctx.actor || 0) | 0;
    if (!normalizedText) return { consumed: false };
    ctx.io.emit("book:open", { actor, title: normalizedTitle, text: normalizedText });
    return { consumed: false };
  };
}

/**
 * @param {any} state
 */
export function canTouchstoneDipTarget(state) {
  return String(state?.targetInfo?.type || "") === "gem";
}

export function createTouchstoneDipHook() {
  return (ctx, state) => {
    const gem = getGem(state.targetIdentity);
    if (!gem) {
      ctx.io.emit("item:applied", {
        actor: state.actor,
        toolId: state.toolId,
        targetId: state.targetId,
        result: { type: "nothing" },
      });
      return { applied: true, consumedTool: false, resultType: "nothing" };
    }

    const wasNew = identify(state.targetIdentity);
    const result = {
      type: "touchstone",
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
    return { applied: true, consumedTool: false, resultType: "touchstone" };
  };
}

/**
 * @param {any} state
 */
export function canGemSocketDipTarget(state) {
  if (String(state?.toolInfo?.type || "") !== "gem") return false;
  const gemDef = getGem(String(state?.toolIdentity || ""));
  if (!gemDef?.socketable) return false;
  const targetInfo = state?.targetInfo;
  if (!targetInfo || String(targetInfo.type || "") !== "equip") return false;
  if (String(targetInfo.slot || "") !== "weapon") return false;
  const maxSockets = Number(targetInfo.maxSockets || 0);
  const sockets = Array.isArray(targetInfo.sockets) ? targetInfo.sockets : [];
  return maxSockets > 0 && sockets.length < maxSockets;
}

export function createGemSocketDipHook(gemId) {
  return (ctx, state) => {
    const gemDef = getGem(gemId);
    if (!gemDef?.socketable) return { applied: false };
    const targetInfo = state.targetInfo;
    const newSockets = Array.isArray(targetInfo.sockets) ? [...targetInfo.sockets, gemId] : [gemId];
    const currentAffixes = Array.isArray(targetInfo.affixes) ? targetInfo.affixes : [];
    const newAffixes = gemDef.socketAffixId && !currentAffixes.includes(gemDef.socketAffixId)
      ? [...currentAffixes, gemDef.socketAffixId]
      : [...currentAffixes];
    ctx.helpers.patchItemInfo(state.targetId, { sockets: newSockets, affixes: newAffixes });
    ctx.io.emit("gem:socketed", { actor: state.actor, weaponId: state.targetId, gemId });
    return { applied: true, consumedTool: true };
  };
}

/**
 * @param {any} state
 */
export function canPoisonDipTarget(state) {
  const toolType = String(state?.toolInfo?.type || "");
  const targetType = String(state?.targetInfo?.type || "");
  const targetSlot = String(state?.targetInfo?.slot || "");
  return toolType === "potion" && targetType === "equip" && targetSlot === "weapon";
}

const STONECOAT_ALLOWED_SLOTS = Object.freeze(new Set([
  "weapon",
  "armor",
  "head",
  "neck",
  "belt",
  "gloves",
  "legs",
  "feet",
  "offhand",
  "ring",
  "ranged",
]));

/**
 * @param {any} state
 */
export function canStonecoatDipTarget(state) {
  const toolType = String(state?.toolInfo?.type || "");
  const targetType = String(state?.targetInfo?.type || "");
  const targetSlot = String(state?.targetInfo?.slot || "").toLowerCase();
  return toolType === "potion" && targetType === "equip" && STONECOAT_ALLOWED_SLOTS.has(targetSlot);
}

/**
 * @param {any} ctx
 * @param {any} state
 * @param {string} fallback
 */
export function resolveApplyTargetName(ctx, state, fallback = "item") {
  const targetId = Number(state?.targetId || ctx?.target || 0) | 0;
  const fromEntityName = String(ctx?.query?.name?.(targetId) || "").trim();
  if (fromEntityName) return fromEntityName;
  const fromInfo = String(state?.targetInfo?.description || "").trim();
  if (fromInfo) return fromInfo;
  const fromIdentity = String(state?.targetIdentity || "").trim();
  if (fromIdentity) return fromIdentity.replace(/_/g, " ");
  return String(fallback || "item");
}

/**
 * Tiny string templater for item-def messages.
 * Supports `$field` and `${field}` placeholders.
 *
 * @param {string} template
 * @param {Record<string, unknown>} fields
 */
function interpolateFields(template, fields) {
  const source = String(template || "");
  const table = (fields && typeof fields === "object") ? fields : {};
  return source.replace(/\$\{([a-zA-Z_]\w*)\}|\$([a-zA-Z_]\w*)/g, (_match, braced, bare) => {
    const key = String(braced || bare || "");
    if (!key) return "";
    const value = Object.prototype.hasOwnProperty.call(table, key) ? table[key] : "";
    return String(value ?? "");
  });
}

/**
 * @param {unknown} value
 * @returns {"blessed"|"uncursed"|"cursed"}
 */
function normalizeBeatitude(value) {
  const beat = String(value || "").toLowerCase();
  if (beat === "blessed") return "blessed";
  if (beat === "cursed") return "cursed";
  return "uncursed";
}

/**
 * @param {"blessed"|"uncursed"|"cursed"} beatitude
 */
function waterTypeFromBeatitude(beatitude) {
  if (beatitude === "blessed") return "holy";
  if (beatitude === "cursed") return "unholy";
  return "plain";
}

export function createWaterPotionHooks() {
  return {
    can_dip_target: (state) => {
      const targetType = String(state?.targetInfo?.type || "");
      return !!targetType && targetType !== "currency";
    },
    on_drink: (ctx, state) => {
      const actorId = Number(state?.actor || ctx.actor || 0) | 0;
      const itemId = Number(state?.itemId || ctx.primary || 0) | 0;
      const targetId = ctx.rules.resolveTarget(actorId);
      const beatitude = normalizeBeatitude(ctx.query.get(itemId, Beatitude)?.state);
      const waterType = waterTypeFromBeatitude(beatitude);
      const hadBurn = ctx.helpers.hasStatus(targetId, "burning") || ctx.helpers.hasStatus(targetId, "burn");

      ctx.helpers.clearEffects(targetId, ["burn", "burning"]);

      if (waterType === "holy") {
        ctx.helpers.addEffect(targetId, {
          key: "blessed",
          potency: 1,
          turnsLeft: 30,
          onsetLeft: 0,
          peakLeft: 0,
          stack: "refresh",
          maxStacks: 1,
          sourceId: itemId,
          meta: { source: "potion_water", waterType: "holy", masked: !state.identified },
        });
      } else if (waterType === "unholy") {
        ctx.helpers.addEffect(targetId, {
          key: "cursed",
          potency: 1,
          turnsLeft: 30,
          onsetLeft: 0,
          peakLeft: 0,
          stack: "refresh",
          maxStacks: 1,
          sourceId: itemId,
          meta: { source: "potion_water", waterType: "unholy", masked: !state.identified },
        });
      }

      ctx.io.emit("water:drank", {
        actor: actorId,
        itemId,
        targetId,
        waterType,
        removedBurn: hadBurn ? 1 : 0,
      });
      return { waterType, removedBurn: hadBurn ? 1 : 0 };
    },
    on_throw: (ctx, state) => {
      const actorId = Number(state?.actor || ctx.actor || 0) | 0;
      const itemId = Number(state?.itemId || ctx.primary || 0) | 0;
      const targetId = Number(state?.targetId || ctx.target || 0) | 0;
      const throwSpec = (state?.throw && typeof state.throw === "object") ? state.throw : null;
      const fallback = ctx.helpers.adjacentPoint(actorId);
      const to = {
        x: Number.isFinite(Number(throwSpec?.to?.x)) ? (Number(throwSpec.to.x) | 0) : (fallback.x | 0),
        y: Number.isFinite(Number(throwSpec?.to?.y)) ? (Number(throwSpec.to.y) | 0) : (fallback.y | 0),
      };
      const from = (
        Number.isFinite(Number(throwSpec?.from?.x)) && Number.isFinite(Number(throwSpec?.from?.y))
          ? { x: Number(throwSpec.from.x) | 0, y: Number(throwSpec.from.y) | 0 }
          : null
      );

      const beatitude = normalizeBeatitude(ctx.query.get(itemId, Beatitude)?.state);
      const waterType = waterTypeFromBeatitude(beatitude);

      ctx.helpers.hazardSpawn({
        kind: "wet_splash",
        medium: "floor",
        turnsLeft: 1,
        radius: 1,
        tickDamage: 0,
        damageType: "generic",
        cause: "thrown_water",
        sourceId: actorId,
        sourceKind: "potion_water",
        meta: { waterType },
      }, to);

      ctx.io.emit("item:thrown", {
        actor: actorId,
        itemId,
        targetId,
        from,
        to: { ...to },
        range: Number.isFinite(Number(throwSpec?.range)) ? (Number(throwSpec.range) | 0) : null,
        maxRange: Number.isFinite(Number(throwSpec?.maxRange)) ? (Number(throwSpec.maxRange) | 0) : null,
        weight: Number.isFinite(Number(throwSpec?.weight)) ? Number(throwSpec.weight) : null,
        path: "itemHooks",
        result: { type: "water_splash", waterType },
      });
      ctx.io.emit("water:splashed", {
        actor: actorId,
        itemId,
        at: { ...to },
        waterType,
      });
      return { consumed: true, resultType: "water_splash", waterType };
    },
    on_dip: (ctx, state) => {
      const actorId = Number(state?.actor || ctx.actor || 0) | 0;
      const toolId = Number(state?.toolId || ctx.primary || 0) | 0;
      const targetId = Number(state?.targetId || ctx.target || 0) | 0;
      const beatitude = normalizeBeatitude(ctx.query.get(toolId, Beatitude)?.state);
      const waterType = waterTypeFromBeatitude(beatitude);

      ctx.io.emit("item:applied", {
        actor: actorId,
        toolId,
        targetId,
        result: {
          type: "water_dip",
          waterType,
        },
      });
      ctx.io.emit("water:dipped", {
        actor: actorId,
        toolId,
        targetId,
        waterType,
      });

      return { applied: true, consumedTool: true, resultType: "water_dip", waterType };
    },
  };
}

/**
 * @param {{
 *   chargesGranted?: number | ((ctx:any, state:any) => number),
 *   messageTemplate?: string,
 * }} [opts]
 */
export function createPoisonCoatDipHook(opts = {}) {
  const resolveChargesGranted = typeof opts?.chargesGranted === "function"
    ? opts.chargesGranted
    : () => Number(opts?.chargesGranted ?? 12);
  const messageTemplate = String(
    opts?.messageTemplate
    || "You coat $targetName with poison (+$chargesGranted charges, total $chargesTotal)."
  );

  return (ctx, state) => {
    const targetInfo = state?.targetInfo;
    if (!targetInfo) return { applied: false, consumedTool: false, resultType: "nothing" };
    const currentCharges = Math.max(0, Number(targetInfo?.coating?.charges || 0) | 0);
    const grantedRaw = Number(resolveChargesGranted(ctx, state));
    const chargesGranted = Math.max(1, Number.isFinite(grantedRaw) ? (grantedRaw | 0) : 1);
    const nextCharges = currentCharges + chargesGranted;
    const coating = { kind: "poison", charges: nextCharges };
    if (opts?.coatingColor) coating.color = opts.coatingColor;
    const targetName = resolveApplyTargetName(ctx, state, "weapon");
    const message = interpolateFields(messageTemplate, {
      targetName,
      currentCharges,
      chargesGranted,
      chargesTotal: nextCharges,
    });
    ctx.helpers.patchItemInfo(state.targetId, { coating });
    ctx.io.emit("item:applied", {
      actor: state.actor,
      toolId: state.toolId,
      targetId: state.targetId,
      result: {
        type: "poison_coat",
        coating,
        chargesGranted,
        chargesTotal: nextCharges,
        message,
      },
    });
    return { applied: true, consumedTool: true, resultType: "poison_coat" };
  };
}

/**
 * Poison throw payload: spawn a persistent poison hazard at the landing tile.
 * No direct burst damage is applied on throw; damage is handled by hazard ticks.
 *
 * @param {{
 *   turnsLeft?: number,
 *   radius?: number,
 *   tickDamage?: number,
 *   medium?: "air"|"floor"|string,
 *   sourceKind?: string,
 }} [opts]
 */
export function createPoisonCloudThrowHook(opts = {}) {
  const turnsLeft = Math.max(1, Number(opts?.turnsLeft ?? 3) | 0);
  const radius = Math.max(0, Number(opts?.radius ?? 1) | 0);
  const tickDamage = Math.max(0, Number(opts?.tickDamage ?? 2) | 0);
  const medium = String(opts?.medium || "floor").toLowerCase() === "air" ? "air" : "floor";
  const sourceKind = String(opts?.sourceKind || "potion_poison") || "potion_poison";

  return (ctx, state) => {
    const actorId = Number(state?.actor || ctx.actor || 0) | 0;
    const itemId = Number(state?.itemId || ctx.primary || 0) | 0;
    const targetId = Number(state?.targetId || ctx.target || 0) | 0;
    const throwSpec = (state?.throw && typeof state.throw === "object") ? state.throw : null;

    const fromRaw = throwSpec?.from;
    const from = {
      x: Number.isFinite(Number(fromRaw?.x)) ? (Number(fromRaw.x) | 0) : 0,
      y: Number.isFinite(Number(fromRaw?.y)) ? (Number(fromRaw.y) | 0) : 0,
    };

    const toRawX = Number(throwSpec?.to?.x ?? state?.targetX ?? from.x);
    const toRawY = Number(throwSpec?.to?.y ?? state?.targetY ?? from.y);
    const at = {
      x: Number.isFinite(toRawX) ? (toRawX | 0) : from.x,
      y: Number.isFinite(toRawY) ? (toRawY | 0) : from.y,
    };

    ctx.helpers.hazardSpawn({
      kind: "poison",
      medium,
      turnsLeft,
      radius,
      tickDamage,
      damageType: "poison",
      cause: "poison_cloud",
      sourceId: itemId,
      sourceKind,
      identity: "poison_cloud",
      name: medium === "floor" ? "Poison Slick" : "Poison Cloud",
      meta: { source: "potion_poison", delivery: "thrown" },
    }, at);

    ctx.io.emit("item:thrown", {
      actor: actorId,
      itemId,
      targetId,
      from,
      to: { x: at.x, y: at.y },
      range: Number.isFinite(Number(throwSpec?.range)) ? (Number(throwSpec.range) | 0) : null,
      maxRange: Number.isFinite(Number(throwSpec?.maxRange)) ? (Number(throwSpec.maxRange) | 0) : null,
      weight: Number.isFinite(Number(throwSpec?.weight)) ? Number(throwSpec.weight) : null,
      path: "itemHooks",
      result: { type: "poison_hazard", kind: "poison", medium },
    });

    return {
      consumed: true,
      at,
      hazardKind: "poison",
      hazardMedium: medium,
    };
  };
}

/**
 * Torch throw hook: landed torches start a small floor fire without consuming
 * the torch item, so the normal base throw can still drop it on the tile.
 *
 * @param {{
 *   turnsLeft?: number,
 *   radius?: number,
 *   tickDamage?: number,
 * }} [opts]
 */
export function createTorchThrowHook(opts = {}) {
  const turnsLeft = Math.max(1, Number(opts?.turnsLeft ?? 3) | 0);
  const radius = Math.max(0, Number(opts?.radius ?? 0) | 0);
  const tickDamage = Math.max(0, Number(opts?.tickDamage ?? 2) | 0);

  return (ctx, state) => {
    const actorId = Number(state?.actor || ctx.actor || 0) | 0;
    const throwSpec = (state?.throw && typeof state.throw === "object") ? state.throw : null;
    const fallbackPoint = ctx.helpers.adjacentPoint(actorId);
    const rawLandingX = Number(throwSpec?.to?.x ?? state?.targetX);
    const rawLandingY = Number(throwSpec?.to?.y ?? state?.targetY);
    const at = {
      x: Number.isFinite(rawLandingX) ? (rawLandingX | 0) : (fallbackPoint.x | 0),
      y: Number.isFinite(rawLandingY) ? (rawLandingY | 0) : (fallbackPoint.y | 0),
    };

    ctx.helpers.hazardSpawn({
      kind: "fire",
      medium: "floor",
      turnsLeft,
      radius,
      tickDamage,
      damageType: "fire",
      cause: "torch_fire",
      sourceId: actorId,
      sourceKind: "torch",
      identity: "torch_fire",
      name: "Torch Fire",
      meta: { source: "torch", delivery: "thrown" },
    }, at);

    return { consumed: false, at, hazardKind: "fire" };
  };
}

export const EAT_ON_USE = createEatOnUseHook();
export const MAPPING_ON_USE = createMappingOnUseHook();
