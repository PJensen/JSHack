// Unified item catalog: equipment + magic/usable items.
// This is the single source of truth for item-like definitions.
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
function createCastSpellFromIdentityHook(opts) {
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
function createLearnSpellFromIdentityHook(opts) {
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
function createOpenFlavorBookHook(title, text) {
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
function canTouchstoneDipTarget(state) {
  return String(state?.targetInfo?.type || "") === "gem";
}

function createTouchstoneDipHook() {
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
function canGemSocketDipTarget(state) {
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

function createGemSocketDipHook(gemId) {
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
function canPoisonDipTarget(state) {
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
function canStonecoatDipTarget(state) {
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
function resolveApplyTargetName(ctx, state, fallback = "item") {
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

function createWaterPotionHooks() {
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
function createPoisonCoatDipHook(opts = {}) {
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
function createPoisonCloudThrowHook(opts = {}) {
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
function createTorchThrowHook(opts = {}) {
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

const EAT_ON_USE = createEatOnUseHook();
const MAPPING_ON_USE = createMappingOnUseHook();

export const ITEM_CATALOG = {
  // Equipment
  staff_oak: {
    id: "staff_oak",
    catalogKind: "equipment",
    name: "Oak Staff",
    type: "equip",
    slot: "weapon",
    twoHanded: true,
    material: "wood",
    rarity: 1,
    rarityName: "common",
    bonuses: { accuracy: 1, damagePower: 1, bluntPenetration: 1, manaRegen: 0.05 },
    damageDice: "1d6",
    damageType: "blunt",
    staminaCost: 7,
    description: "A sturdy staff of ancient oak. Channels natural energies.",
  },
  longsword: {
    id: "longsword",
    catalogKind: "equipment",
    name: "Longsword",
    type: "equip",
    slot: "weapon",
    twoHanded: true,
    material: "steel",
    rarity: 1,
    rarityName: "common",
    bonuses: { accuracy: 2, damagePower: 3, slashPenetration: 2 },
    maxSockets: 2,
    damageDice: "1d8",
    damageType: "slash",
    staminaCost: 12,
    description: "A long steel blade wielded with both hands.",
  },
  sword_plain: {
    id: "sword_plain",
    catalogKind: "equipment",
    name: "Short Sword",
    type: "equip",
    slot: "weapon",
    material: "steel",
    rarity: 1,
    rarityName: "common",
    bonuses: { accuracy: 2, damagePower: 2, slashPenetration: 1 },
    damageDice: "1d6",
    damageType: "slash",
    staminaCost: 8,
    maxSockets: 1,
    description: "A trusty short blade. Quick to draw and easy to wield.",
  },
  dagger_quick: {
    id: "dagger_quick",
    catalogKind: "equipment",
    name: "Dagger",
    type: "equip",
    slot: "weapon",
    material: "steel",
    rarity: 1,
    rarityName: "common",
    bonuses: { accuracy: 2, damagePower: 0, piercePenetration: 2, critChance: 0.02 },
    damageDice: "1d4",
    damageType: "pierce",
    staminaCost: 5,
    description: "A slim steel blade, light enough to strike in a blink.",
  },
  goblin_shiv: {
    id: "goblin_shiv",
    catalogKind: "equipment",
    name: "Goblin Shiv",
    type: "equip",
    slot: "weapon",
    material: "iron",
    rarity: 1,
    rarityName: "common",
    bonuses: { accuracy: 1, damagePower: 0, piercePenetration: 1, critChance: 0.01 },
    damageDice: "1d4",
    damageType: "pierce",
    staminaCost: 5,
    value: 1,
    description: "A chipped goblin knife. Cheap, mean, and disposable.",
  },
  goblin_jagged_shiv: {
    id: "goblin_jagged_shiv",
    catalogKind: "equipment",
    name: "Goblin Jagged Shiv",
    type: "equip",
    slot: "weapon",
    material: "iron",
    rarity: 1,
    rarityName: "common",
    bonuses: { accuracy: 1, damagePower: 0, piercePenetration: 1, critChance: 0.01 },
    damageDice: "1d4",
    damageType: "pierce",
    staminaCost: 5,
    value: 2,
    description: "A serrated shiv with burrs that tear flesh on the way out.",
    affixes: ["hemorrhage1"],
  },
  hobgoblin_warblade: {
    id: "hobgoblin_warblade",
    catalogKind: "equipment",
    name: "Hobgoblin Warblade",
    type: "equip",
    slot: "weapon",
    material: "steel",
    rarity: 2,
    rarityName: "magic",
    bonuses: { accuracy: 2, damagePower: 2, slashPenetration: 1 },
    damageDice: "1d8",
    damageType: "slash",
    staminaCost: 9,
    value: 8,
    description: "A disciplined infantry blade balanced for drill-yard brutality.",
  },
  hobgoblin_serrated_warblade: {
    id: "hobgoblin_serrated_warblade",
    catalogKind: "equipment",
    name: "Hobgoblin Serrated Warblade",
    type: "equip",
    slot: "weapon",
    material: "steel",
    rarity: 2,
    rarityName: "magic",
    bonuses: { accuracy: 2, damagePower: 2, slashPenetration: 1 },
    damageDice: "1d8",
    damageType: "slash",
    staminaCost: 9,
    value: 9,
    description: "Saw-backed iron made to leave ugly, lasting wounds.",
    affixes: ["hemorrhage1"],
  },
  ogre_crushing_club: {
    id: "ogre_crushing_club",
    catalogKind: "equipment",
    name: "Ogre Crushing Club",
    type: "equip",
    slot: "weapon",
    material: "wood",
    rarity: 2,
    rarityName: "magic",
    bonuses: { accuracy: 0, damagePower: 3, bluntPenetration: 2 },
    damageDice: "2d8",
    damageType: "blunt",
    staminaCost: 13,
    value: 6,
    description: "A tree limb with iron bands and dried blood at the knots.",
    affixes: ["stunning1"],
  },
  orc_warchief_maul: {
    id: "orc_warchief_maul",
    catalogKind: "equipment",
    name: "Orc Warchief Maul",
    type: "equip",
    slot: "weapon",
    material: "iron",
    rarity: 3,
    rarityName: "rare",
    bonuses: { accuracy: 1, damagePower: 3, bluntPenetration: 3 },
    damageDice: "2d6",
    damageType: "blunt",
    staminaCost: 12,
    value: 14,
    description: "A commander's maul that ends arguments in one swing.",
    affixes: ["stunning1"],
  },
  axe_heavy: {
    id: "axe_heavy",
    catalogKind: "equipment",
    name: "Axe",
    type: "equip",
    slot: "weapon",
    material: "steel",
    rarity: 2,
    rarityName: "magic",
    bonuses: { accuracy: 2, damagePower: 3, slashPenetration: 2, chop: 1 },
    damageDice: "1d8",
    damageType: "slash",
    staminaCost: 12,
    maxSockets: 1,
    description: "A broad-headed axe that cleaves through armor and timber alike.",
  },
  iron_mace: {
    id: "iron_mace",
    catalogKind: "equipment",
    name: "Iron Mace",
    type: "equip",
    slot: "weapon",
    material: "iron",
    rarity: 1,
    rarityName: "common",
    bonuses: { accuracy: 1, damagePower: 2, bluntPenetration: 3 },
    damageDice: "1d8",
    damageType: "blunt",
    staminaCost: 11,
    maxSockets: 1,
    description: "A heavy iron head on a wooden haft. Favored by the faithful.",
    affixes: ["stunning1"],
  },
  leather_armor: {
    id: "leather_armor",
    catalogKind: "equipment",
    name: "Leather Armor",
    type: "equip",
    slot: "armor",
    material: "leather",
    rarity: 1,
    rarityName: "common",
    bonuses: { defense: 1 },
  },
  chain_armor: {
    id: "chain_armor",
    catalogKind: "equipment",
    name: "Chainmail",
    type: "equip",
    slot: "armor",
    material: "iron",
    rarity: 2,
    rarityName: "magic",
    bonuses: { defense: 2 },
  },
  helm_iron: {
    id: "helm_iron",
    catalogKind: "equipment",
    name: "Iron Helm",
    type: "equip",
    slot: "head",
    material: "iron",
    rarity: 1,
    rarityName: "common",
    bonuses: { defense: 1 },
  },
  // ── Head: early-mid ──────────────────────────────────────────────
  helm_steel: {
    id: "helm_steel",
    catalogKind: "equipment",
    name: "Steel Helm",
    type: "equip",
    slot: "head",
    material: "steel",
    rarity: 2,
    rarityName: "magic",
    bonuses: { defense: 2, bluntResist: 0.05 },
    description: "A sturdy helm with a nose guard and padded lining.",
  },
  // ── Head: mid-game ───────────────────────────────────────────────
  helm_horned: {
    id: "helm_horned",
    catalogKind: "equipment",
    name: "Horned Helm",
    type: "equip",
    slot: "head",
    material: "iron",
    rarity: 3,
    rarityName: "rare",
    bonuses: { defense: 2, attack: 1, bluntResist: 0.1 },
    description: "Curved iron horns crown this battle-scarred helm.",
  },
  helm_mage: {
    id: "helm_mage",
    catalogKind: "equipment",
    name: "Circlet of Insight",
    type: "equip",
    slot: "head",
    material: "silver",
    rarity: 3,
    rarityName: "rare",
    bonuses: { maxMana: 12, manaRegen: 0.3 },
    description: "A thin silver band that clears the fog of thought.",
    affixes: ["helmAttuned1"],
  },
  // ── Head: late-game ──────────────────────────────────────────────
  helm_warhelm: {
    id: "helm_warhelm",
    catalogKind: "equipment",
    name: "Great Warhelm",
    type: "equip",
    slot: "head",
    material: "steel",
    rarity: 4,
    rarityName: "epic",
    bonuses: { defense: 3, maxHp: 10, bluntResist: 0.15, slashResist: 0.1 },
    description: "A full-faced helm forged for the front lines. Vision is limited, but so is incoming steel.",
    affixes: ["helmGuard1"],
  },
  helm_visionary: {
    id: "helm_visionary",
    catalogKind: "equipment",
    name: "Visionary Crown",
    type: "equip",
    slot: "head",
    material: "gold",
    rarity: 4,
    rarityName: "epic",
    bonuses: { maxMana: 18, manaRegen: 0.5, critChance: 0.04 },
    description: "Amethyst shards orbit the crown, whispering arcane secrets.",
    affixes: ["helmAttuned1"],
  },
  // ── Head: endgame ────────────────────────────────────────────────
  helm_dreadnought: {
    id: "helm_dreadnought",
    catalogKind: "equipment",
    name: "Dreadnought Helm",
    type: "equip",
    slot: "head",
    material: "steel",
    rarity: 5,
    rarityName: "legendary",
    bonuses: { defense: 4, maxHp: 15, bluntResist: 0.2, slashResist: 0.15, pierceResist: 0.1 },
    description: "An unyielding fortress of riveted steel. Those who wear it fear nothing.",
    affixes: ["helmGuard1"],
  },
  helm_allseeing: {
    id: "helm_allseeing",
    catalogKind: "equipment",
    name: "Crown of the All-Seeing",
    type: "equip",
    slot: "head",
    material: "gold",
    rarity: 5,
    rarityName: "legendary",
    bonuses: { maxMana: 25, manaRegen: 0.7, critChance: 0.06, luck: 2 },
    description: "A third eye opens in the wearer's mind, bending fate to their will.",
    affixes: ["helmAttuned1"],
  },
  amulet_guarded: {
    id: "amulet_guarded",
    catalogKind: "equipment",
    name: "Guarded Amulet",
    type: "equip",
    slot: "neck",
    material: "silver",
    rarity: 1,
    rarityName: "common",
    bonuses: { defense: 1 },
  },
  pendant_lucky: {
    id: "pendant_lucky",
    catalogKind: "equipment",
    name: "Lucky Pendant",
    type: "equip",
    slot: "neck",
    material: "gold",
    rarity: 2,
    rarityName: "magic",
    bonuses: { luck: 1 },
    description: "A battered charm that has outlived every owner who wore it.",
  },
  amulet_vigor: {
    id: "amulet_vigor",
    catalogKind: "equipment",
    name: "Amulet of Vigor",
    type: "equip",
    slot: "neck",
    material: "gold",
    rarity: 2,
    rarityName: "magic",
    bonuses: { maxStamina: 10, staminaRegen: 0.3 },
  },
  // ── Neck: mid-game ───────────────────────────────────────────────
  amulet_warding: {
    id: "amulet_warding",
    catalogKind: "equipment",
    name: "Warding Amulet",
    type: "equip",
    slot: "neck",
    material: "silver",
    rarity: 3,
    rarityName: "rare",
    bonuses: { defense: 2, poisonResist: 0.15 },
    description: "Runes etched into the silver hum faintly, turning aside blight.",
  },
  amulet_focus: {
    id: "amulet_focus",
    catalogKind: "equipment",
    name: "Amulet of Focus",
    type: "equip",
    slot: "neck",
    material: "gold",
    rarity: 3,
    rarityName: "rare",
    bonuses: { maxMana: 15, manaRegen: 0.4, spellHit: 1 },
    description: "A pale sapphire set in gold that sharpens the mind.",
  },
  // ── Neck: late-game ──────────────────────────────────────────────
  pendant_soulkeeper: {
    id: "pendant_soulkeeper",
    catalogKind: "equipment",
    name: "Soulkeeper Pendant",
    type: "equip",
    slot: "neck",
    material: "gold",
    rarity: 4,
    rarityName: "epic",
    bonuses: { maxHp: 20, defense: 1, fireResist: 0.15 },
    description: "A warm ember pulses inside the gem, anchoring the wearer's life force.",
  },
  pendant_stormward: {
    id: "pendant_stormward",
    catalogKind: "equipment",
    name: "Stormward Pendant",
    type: "equip",
    slot: "neck",
    material: "silver",
    rarity: 4,
    rarityName: "epic",
    bonuses: { defense: 2, electricOhms: 200, acidResist: 0.15 },
    description: "Crackling filaments ground lightning before it can reach the heart.",
  },
  // ── Neck: endgame ────────────────────────────────────────────────
  amulet_lifeblood: {
    id: "amulet_lifeblood",
    catalogKind: "equipment",
    name: "Amulet of Lifeblood",
    type: "equip",
    slot: "neck",
    material: "gold",
    rarity: 5,
    rarityName: "legendary",
    bonuses: { maxHp: 25, defense: 1, staminaRegen: 0.5 },
    description: "Warm to the touch, it quickens the blood and knits wounds shut between blows.",
    affixes: ["secondWind1"],
  },
  amulet_arcanum: {
    id: "amulet_arcanum",
    catalogKind: "equipment",
    name: "Arcanum Pendant",
    type: "equip",
    slot: "neck",
    material: "gold",
    rarity: 5,
    rarityName: "legendary",
    bonuses: { maxMana: 30, manaRegen: 0.8, critChance: 0.05, spellHit: 3 },
    description: "An ancient conduit that draws mana from the ether itself.",
  },
  belt_leather: {
    id: "belt_leather",
    catalogKind: "equipment",
    name: "Leather Belt",
    type: "equip",
    slot: "belt",
    material: "leather",
    rarity: 1,
    rarityName: "common",
    bonuses: { defense: 1 },
  },
  belt_girded: {
    id: "belt_girded",
    catalogKind: "equipment",
    name: "Girded Belt",
    type: "equip",
    slot: "belt",
    material: "leather",
    rarity: 2,
    rarityName: "magic",
    bonuses: { maxStamina: 12, staminaRegen: 0.4 },
  },
  // ── Belt: mid-game ───────────────────────────────────────────────
  belt_chain: {
    id: "belt_chain",
    catalogKind: "equipment",
    name: "Chain Belt",
    type: "equip",
    slot: "belt",
    material: "iron",
    rarity: 3,
    rarityName: "rare",
    bonuses: { defense: 2, maxHp: 8 },
    description: "Interlocking iron rings cinched tight around the waist.",
  },
  belt_ranger: {
    id: "belt_ranger",
    catalogKind: "equipment",
    name: "Ranger's Belt",
    type: "equip",
    slot: "belt",
    material: "leather",
    rarity: 3,
    rarityName: "rare",
    bonuses: { attack: 1, maxStamina: 10, staminaRegen: 0.3 },
    description: "A worn utility belt with loops for blades and pouches for herbs.",
  },
  // ── Belt: late-game ──────────────────────────────────────────────
  belt_ironhide: {
    id: "belt_ironhide",
    catalogKind: "equipment",
    name: "Ironhide Girdle",
    type: "equip",
    slot: "belt",
    material: "iron",
    rarity: 4,
    rarityName: "epic",
    bonuses: { defense: 3, bluntResist: 0.15, slashResist: 0.1 },
    description: "Thick plates of hammered iron overlap like dragon scales.",
  },
  belt_vitality: {
    id: "belt_vitality",
    catalogKind: "equipment",
    name: "Belt of Vitality",
    type: "equip",
    slot: "belt",
    material: "leather",
    rarity: 4,
    rarityName: "epic",
    bonuses: { maxHp: 20, maxStamina: 12, staminaRegen: 0.4 },
    description: "Threaded with sinew of cave trolls, it lends their stubborn endurance.",
  },
  // ── Belt: endgame ────────────────────────────────────────────────
  belt_titan: {
    id: "belt_titan",
    catalogKind: "equipment",
    name: "Titan's Girdle",
    type: "equip",
    slot: "belt",
    material: "steel",
    rarity: 5,
    rarityName: "legendary",
    bonuses: { defense: 3, maxHp: 20, maxStamina: 15, staminaRegen: 0.5, bluntResist: 0.1 },
    description: "Forged from the belt buckle of a fallen giant. Its weight is immense, its strength greater.",
  },
  belt_serpent: {
    id: "belt_serpent",
    catalogKind: "equipment",
    name: "Serpent's Coil",
    type: "equip",
    slot: "belt",
    material: "leather",
    rarity: 5,
    rarityName: "legendary",
    bonuses: { attack: 2, poisonResist: 0.25, luck: 2 },
    description: "A living snakeskin that slithers tighter in battle, sharpening the wearer's instincts.",
  },
  gloves_leather: {
    id: "gloves_leather",
    catalogKind: "equipment",
    name: "Leather Gloves",
    type: "equip",
    slot: "gloves",
    material: "leather",
    rarity: 1,
    rarityName: "common",
    bonuses: { defense: 1 },
  },
  gauntlets_iron: {
    id: "gauntlets_iron",
    catalogKind: "equipment",
    name: "Iron Gauntlets",
    type: "equip",
    slot: "gloves",
    material: "iron",
    rarity: 2,
    rarityName: "magic",
    bonuses: { defense: 2, attack: 1 },
  },
  // ── Gloves: mid-game ─────────────────────────────────────────────
  gauntlets_steel: {
    id: "gauntlets_steel",
    catalogKind: "equipment",
    name: "Steel Gauntlets",
    type: "equip",
    slot: "gloves",
    material: "steel",
    rarity: 3,
    rarityName: "rare",
    bonuses: { defense: 3, attack: 1 },
    description: "Polished steel plates riveted over hardened leather.",
  },
  gloves_thieves: {
    id: "gloves_thieves",
    catalogKind: "equipment",
    name: "Thief's Gloves",
    type: "equip",
    slot: "gloves",
    material: "leather",
    rarity: 3,
    rarityName: "rare",
    bonuses: { attack: 2, critChance: 0.05, luck: 1 },
    description: "Supple black leather with grip-pads sewn into every finger.",
  },
  // ── Gloves: late-game ────────────────────────────────────────────
  gauntlets_spiked: {
    id: "gauntlets_spiked",
    catalogKind: "equipment",
    name: "Spiked Gauntlets",
    type: "equip",
    slot: "gloves",
    material: "iron",
    rarity: 4,
    rarityName: "epic",
    bonuses: { defense: 2, attack: 2 },
    description: "Iron spikes jut from the knuckles, punishing anyone who strikes the wearer.",
    affixes: ["thorns1"],
  },
  gloves_arcane: {
    id: "gloves_arcane",
    catalogKind: "equipment",
    name: "Arcane Handwraps",
    type: "equip",
    slot: "gloves",
    material: "cloth",
    rarity: 4,
    rarityName: "epic",
    bonuses: { defense: 1, maxMana: 12, manaRegen: 0.5, critChance: 0.03, spellHit: 2 },
    description: "Silk wraps stitched with silver thread that steady hostile spellwork and hum with residual magic.",
  },
  // ── Gloves: endgame ──────────────────────────────────────────────
  gauntlets_dragonscale: {
    id: "gauntlets_dragonscale",
    catalogKind: "equipment",
    name: "Dragonscale Gauntlets",
    type: "equip",
    slot: "gloves",
    material: "steel",
    rarity: 5,
    rarityName: "legendary",
    bonuses: { defense: 4, attack: 2, fireResist: 0.2, slashResist: 0.15 },
    description: "Overlapping crimson scales shed heat like water off stone.",
  },
  gloves_shadow: {
    id: "gloves_shadow",
    catalogKind: "equipment",
    name: "Shadowgrasp Gloves",
    type: "equip",
    slot: "gloves",
    material: "leather",
    rarity: 5,
    rarityName: "legendary",
    bonuses: { attack: 3, critChance: 0.1, luck: 2 },
    description: "Woven from umbral thread, they guide the hand to every weakness.",
  },
  leggings_leather: {
    id: "leggings_leather",
    catalogKind: "equipment",
    name: "Leather Leggings",
    type: "equip",
    slot: "legs",
    material: "leather",
    rarity: 1,
    rarityName: "common",
    bonuses: { defense: 1 },
  },
  greaves_steel: {
    id: "greaves_steel",
    catalogKind: "equipment",
    name: "Steel Cuisses",
    type: "equip",
    slot: "legs",
    material: "steel",
    rarity: 2,
    rarityName: "magic",
    bonuses: { defense: 2, bluntResist: 0.15 },
  },
  // ── Legs: rare ──────────────────────────────────────────────────
  legguards_plated: {
    id: "legguards_plated",
    catalogKind: "equipment",
    name: "Plated Legguards",
    type: "equip",
    slot: "legs",
    material: "iron",
    rarity: 3,
    rarityName: "rare",
    bonuses: { defense: 3, maxHp: 8 },
    description: "Overlapping iron plates secured with heavy rivets protect from knee to thigh.",
  },
  leggings_scout: {
    id: "leggings_scout",
    catalogKind: "equipment",
    name: "Scout's Leggings",
    type: "equip",
    slot: "legs",
    material: "leather",
    rarity: 3,
    rarityName: "rare",
    bonuses: { defense: 1, attack: 1, maxStamina: 10, staminaRegen: 0.3 },
    description: "Supple hide trousers with reinforced knees for long marches and quick sprints.",
  },
  // ── Legs: epic ──────────────────────────────────────────────────
  legguards_fortress: {
    id: "legguards_fortress",
    catalogKind: "equipment",
    name: "Fortress Greaves",
    type: "equip",
    slot: "legs",
    material: "steel",
    rarity: 4,
    rarityName: "epic",
    bonuses: { defense: 3, maxHp: 12, bluntResist: 0.15, slashResist: 0.1 },
    description: "Steel leg-plates shaped to deflect blows downward, anchoring the wearer like a tower.",
    affixes: ["kineticWard1"],
  },
  leggings_prowler: {
    id: "leggings_prowler",
    catalogKind: "equipment",
    name: "Prowler's Breeches",
    type: "equip",
    slot: "legs",
    material: "leather",
    rarity: 4,
    rarityName: "epic",
    bonuses: { defense: 2, attack: 1, critChance: 0.04, maxStamina: 12, staminaRegen: 0.3 },
    description: "Fitted with silent-step soles and hidden blade sheaths along each thigh.",
    affixes: ["guard1"],
  },
  leggings_mystic: {
    id: "leggings_mystic",
    catalogKind: "equipment",
    name: "Mystic Breeches",
    type: "equip",
    slot: "legs",
    material: "cloth",
    rarity: 4,
    rarityName: "epic",
    bonuses: { defense: 1, maxMana: 15, manaRegen: 0.4, spellHit: 1 },
    description: "Embroidered with sigils of containment that keep volatile mana from leaking.",
    affixes: ["life1"],
  },
  // ── Legs: legendary ─────────────────────────────────────────────
  legguards_colossus: {
    id: "legguards_colossus",
    catalogKind: "equipment",
    name: "Colossus Legguards",
    type: "equip",
    slot: "legs",
    material: "steel",
    rarity: 5,
    rarityName: "legendary",
    bonuses: { defense: 4, maxHp: 20, bluntResist: 0.2, slashResist: 0.15, pierceResist: 0.1 },
    description: "Scaled in titan-forged steel, each step shakes the ground.",
    affixes: ["shieldWall1"],
  },
  leggings_wraith: {
    id: "leggings_wraith",
    catalogKind: "equipment",
    name: "Wraithweave Leggings",
    type: "equip",
    slot: "legs",
    material: "leather",
    rarity: 5,
    rarityName: "legendary",
    bonuses: { defense: 2, attack: 2, critChance: 0.08, maxStamina: 15, staminaRegen: 0.4, luck: 1 },
    description: "Woven from fibers that absorb light, the wearer's footfalls make no sound.",
    affixes: ["guard1"],
  },
  // ── Rings: common ───────────────────────────────────────────────
  ring_copper: {
    id: "ring_copper",
    catalogKind: "equipment",
    name: "Copper Ring",
    type: "equip",
    slot: "ring",
    material: "copper",
    rarity: 1,
    rarityName: "common",
    bonuses: { defense: 1 },
    description: "A simple hammered copper band, green with patina.",
  },
  ring_bone: {
    id: "ring_bone",
    catalogKind: "equipment",
    name: "Bone Ring",
    type: "equip",
    slot: "ring",
    material: "bone",
    rarity: 1,
    rarityName: "common",
    bonuses: { maxHp: 3 },
    description: "Carved from a knuckle bone. It carries a faint warmth.",
  },
  ring_health: {
    id: "ring_health",
    catalogKind: "equipment",
    name: "Ring of Health",
    type: "equip",
    slot: "ring",
    material: "gold",
    rarity: 2,
    rarityName: "magic",
    bonuses: { maxHp: 5 },
  },
  ring_precision: {
    id: "ring_precision",
    catalogKind: "equipment",
    name: "Ring of Precision",
    type: "equip",
    slot: "ring",
    material: "silver",
    rarity: 2,
    rarityName: "magic",
    bonuses: { critChance: 0.08 },
  },
  ring_arcana: {
    id: "ring_arcana",
    catalogKind: "equipment",
    name: "Ring of Arcana",
    type: "equip",
    slot: "ring",
    material: "silver",
    rarity: 3,
    rarityName: "rare",
    bonuses: { manaRegen: 0.5, spellHit: 1 },
  },
  ring_fire_resist: {
    id: "ring_fire_resist",
    catalogKind: "equipment",
    name: "Ring of Fire Resistance",
    type: "equip",
    slot: "ring",
    material: "gold",
    rarity: 2,
    rarityName: "magic",
    bonuses: { fireResist: 0.3 },
  },
  ring_poison_resist: {
    id: "ring_poison_resist",
    catalogKind: "equipment",
    name: "Ring of Poison Resistance",
    type: "equip",
    slot: "ring",
    material: "silver",
    rarity: 2,
    rarityName: "magic",
    bonuses: { poisonResist: 0.3 },
  },
  shield_fireward: {
    id: "shield_fireward",
    catalogKind: "equipment",
    name: "Fireward Shield",
    type: "equip",
    slot: "offhand",
    material: "iron",
    rarity: 3,
    rarityName: "rare",
    bonuses: { defense: 1, fireResist: 0.2 },
  },
  shield_wood: {
    id: "shield_wood",
    catalogKind: "equipment",
    name: "Wooden Shield",
    type: "equip",
    slot: "offhand",
    material: "wood",
    rarity: 1,
    rarityName: "common",
    bonuses: { defense: 1 },
  },
  shield_iron: {
    id: "shield_iron",
    catalogKind: "equipment",
    name: "Iron Shield",
    type: "equip",
    slot: "offhand",
    material: "iron",
    rarity: 2,
    rarityName: "magic",
    bonuses: { defense: 2 },
  },
  lantern: {
    id: "lantern",
    catalogKind: "equipment",
    name: "Lantern",
    type: "equip",
    slot: "offhand",
    material: "iron",
    rarity: 2,
    rarityName: "magic",
    bonuses: { visionRange: 3 },
    description: "A sturdy hooded lantern that casts a warm glow, illuminating the darkness ahead.",
  },
  torch: {
    id: "torch",
    catalogKind: "equipment",
    name: "Torch",
    type: "equip",
    slot: "offhand",
    material: "wood",
    rarity: 1,
    rarityName: "common",
    weight: 1,
    value: 2,
    bonuses: {},
    description: "A burning torch with a steady flame. It does not seem likely to run out any time soon.",
    hooks: {
      on_throw: createTorchThrowHook({
        turnsLeft: 3,
        radius: 0,
        tickDamage: 2,
      }),
    },
  },
  iron_pickaxe: {
    id: "iron_pickaxe",
    catalogKind: "equipment",
    name: "Iron Pickaxe",
    type: "equip",
    slot: "weapon",
    material: "iron",
    rarity: 1,
    rarityName: "common",
    bonuses: { accuracy: 0, damagePower: 2, piercePenetration: 4, dig: 1 },
    damageDice: "1d12",
    damageType: "pierce",
    staminaCost: 20,
  },
  bow_short: {
    id: "bow_short",
    catalogKind: "equipment",
    name: "Short Bow",
    type: "equip",
    slot: "ranged",
    material: "wood",
    subtype: "bow",
    rarity: 1,
    rarityName: "common",
    bonuses: { attack: 1 },
    damageDice: "1d6",
    range: 8,
    staminaCost: 6,
  },
  goblin_barbed_shortbow: {
    id: "goblin_barbed_shortbow",
    catalogKind: "equipment",
    name: "Goblin Barbed Shortbow",
    type: "equip",
    slot: "ranged",
    material: "wood",
    subtype: "bow",
    rarity: 1,
    rarityName: "common",
    bonuses: { attack: 1 },
    damageDice: "1d6",
    range: 8,
    staminaCost: 6,
    value: 3,
    description: "A crude shortbow tuned for barbed shafts and dirty kills.",
    affixes: ["hemorrhage1"],
  },
  bow_mirror: {
    id: "bow_mirror",
    catalogKind: "equipment",
    name: "Mirror Bow",
    type: "equip",
    slot: "ranged",
    material: "wood",
    subtype: "bow",
    rarity: 3,
    rarityName: "rare",
    bonuses: { attack: 2 },
    damageDice: "1d6",
    range: 8,
    staminaCost: 6,
    description: "A polished bow that throws wall-side impacts into nearby hostiles.",
    procPackages: ["ricochetTheology"],
  },
  bow_long: {
    id: "bow_long",
    catalogKind: "equipment",
    name: "Longbow",
    type: "equip",
    slot: "ranged",
    material: "wood",
    subtype: "bow",
    rarity: 2,
    rarityName: "magic",
    bonuses: { attack: 2 },
    damageDice: "1d8",
    range: 10,
    staminaCost: 8,
  },
  bow_flaming: {
    id: "bow_flaming",
    catalogKind: "equipment",
    name: "Flamebound Bow",
    type: "equip",
    slot: "ranged",
    material: "wood",
    subtype: "bow",
    rarity: 2,
    rarityName: "magic",
    bonuses: { attack: 2 },
    damageDice: "1d8",
    range: 9,
    staminaCost: 7,
    description: "Its string hums like a forge draft. Shots land hot enough to ignite flesh.",
    affixes: ["flaming"],
  },
  bow_composite: {
    id: "bow_composite",
    catalogKind: "equipment",
    name: "Composite Bow",
    type: "equip",
    slot: "ranged",
    material: "wood",
    subtype: "bow",
    rarity: 4,
    rarityName: "epic",
    bonuses: { attack: 3 },
    damageDice: "1d10",
    range: 10,
    staminaCost: 7,
  },
  bow_shadow: {
    id: "bow_shadow",
    catalogKind: "equipment",
    name: "Shadowstring Bow",
    type: "equip",
    slot: "ranged",
    material: "wood",
    subtype: "bow",
    rarity: 5,
    rarityName: "legendary",
    bonuses: { attack: 4 },
    damageDice: "1d10",
    range: 12,
    staminaCost: 6,
  },
  warhammer: {
    id: "warhammer",
    catalogKind: "equipment",
    name: "Warhammer",
    type: "equip",
    slot: "weapon",
    material: "iron",
    rarity: 2,
    rarityName: "magic",
    bonuses: { attack: 2, critMult: 0.5 },
    damageDice: "1d8",
    damageType: "blunt",
    staminaCost: 10,
    affixes: ["stunning1"],
  },
  venomfang_dagger: {
    id: "venomfang_dagger",
    catalogKind: "equipment",
    name: "Venomfang Dagger",
    type: "equip",
    slot: "weapon",
    material: "steel",
    rarity: 2,
    rarityName: "magic",
    bonuses: { attack: 1, critChance: 0.05 },
    damageDice: "1d4",
    staminaCost: 5,
  },
  nightfang_dagger: {
    id: "nightfang_dagger",
    catalogKind: "equipment",
    name: "Nightfang",
    type: "equip",
    slot: "weapon",
    material: "steel",
    rarity: 3,
    rarityName: "rare",
    bonuses: { attack: 2, critChance: 0.08 },
    damageDice: "1d6",
    staminaCost: 5,
    description: "A blackened blade that weeps venom from its edge.",
    affixes: ["venomous1"],
  },
  voidmind_athame: {
    id: "voidmind_athame",
    catalogKind: "equipment",
    name: "Voidmind Athame",
    type: "equip",
    slot: "weapon",
    material: "steel",
    rarity: 4,
    rarityName: "epic",
    bonuses: { attack: 1, maxMana: 20, manaRegen: 0.5, spellHit: 3, critChance: 0.06 },
    damageDice: "1d4",
    staminaCost: 5,
    description: "A ritual blade etched with spiralling glyphs that drink in ambient mana. Casters prize it above any sword.",
  },
  leadweave_mantle: {
    id: "leadweave_mantle",
    catalogKind: "equipment",
    name: "Leadweave Mantle",
    type: "equip",
    slot: "armor",
    material: "iron",
    rarity: 3,
    rarityName: "rare",
    bonuses: { defense: 1, slashResist: 0.2, electricOhms: 150, acidResist: 0.15 },
  },
  ring_endurance: {
    id: "ring_endurance",
    catalogKind: "equipment",
    name: "Ring of Endurance",
    type: "equip",
    slot: "ring",
    material: "gold",
    rarity: 2,
    rarityName: "magic",
    bonuses: { maxStamina: 15, staminaRegen: 0.5 },
  },
  boots_of_vigor: {
    id: "boots_of_vigor",
    catalogKind: "equipment",
    name: "Boots of Vigor",
    type: "equip",
    slot: "feet",
    material: "leather",
    rarity: 2,
    rarityName: "magic",
    bonuses: { staminaRegen: 1.0 },
  },
  shield_spiked_pavise: {
    id: "shield_spiked_pavise",
    catalogKind: "equipment",
    name: "Spiked Pavise",
    type: "equip",
    slot: "offhand",
    material: "iron",
    rarity: 2,
    rarityName: "magic",
    bonuses: { defense: 2, pierceResist: 0.2, bluntResist: 0.15 },
  },
  caustic_stiletto: {
    id: "caustic_stiletto",
    catalogKind: "equipment",
    name: "Caustic Stiletto",
    type: "equip",
    slot: "weapon",
    material: "steel",
    rarity: 3,
    rarityName: "rare",
    bonuses: { attack: 1, acidResist: 0.1 },
    damageDice: "1d4",
    staminaCost: 4,
    affixes: ["caustic1"],
  },
  stormtouched_mace: {
    id: "stormtouched_mace",
    catalogKind: "equipment",
    name: "Stormtouched Mace",
    type: "equip",
    slot: "weapon",
    material: "iron",
    rarity: 3,
    rarityName: "rare",
    bonuses: { attack: 2 },
    damageDice: "1d6",
    damageType: "blunt",
    staminaCost: 8,
    affixes: ["capacitive1", "stunning1"],
  },
  grounded_buckler: {
    id: "grounded_buckler",
    catalogKind: "equipment",
    name: "Grounded Buckler",
    type: "equip",
    slot: "offhand",
    material: "iron",
    rarity: 3,
    rarityName: "rare",
    bonuses: { defense: 1 },
    affixes: ["insulated1"],
  },
  warhammer_of_fury: {
    id: "warhammer_of_fury",
    catalogKind: "equipment",
    name: "Warhammer of Fury",
    type: "equip",
    slot: "weapon",
    material: "iron",
    rarity: 3,
    rarityName: "rare",
    bonuses: { attack: 1 },
    damageDice: "1d8",
    damageType: "blunt",
    staminaCost: 7,
    affixes: ["fierce", "stunning1"],
  },
  ring_sorcery: {
    id: "ring_sorcery",
    catalogKind: "equipment",
    name: "Ring of Sorcery",
    type: "equip",
    slot: "ring",
    material: "silver",
    rarity: 2,
    rarityName: "magic",
    bonuses: { maxMana: 10 },
  },
  ring_channeling: {
    id: "ring_channeling",
    catalogKind: "equipment",
    name: "Ring of Channeling",
    type: "equip",
    slot: "ring",
    material: "gold",
    rarity: 2,
    rarityName: "magic",
    bonuses: { maxMana: 5, manaRegen: 0.08 },
  },
  boots_leather: {
    id: "boots_leather",
    catalogKind: "equipment",
    name: "Leather Boots",
    type: "equip",
    slot: "feet",
    material: "leather",
    rarity: 1,
    rarityName: "common",
    bonuses: {},
  },
  sandals_hemp: {
    id: "sandals_hemp",
    catalogKind: "equipment",
    name: "Hemp Sandals",
    type: "equip",
    slot: "feet",
    material: "cloth",
    rarity: 1,
    rarityName: "common",
    bonuses: {},
  },
  shoes_cloth: {
    id: "shoes_cloth",
    catalogKind: "equipment",
    name: "Pilgrim Shoes",
    type: "equip",
    slot: "feet",
    material: "cloth",
    rarity: 1,
    rarityName: "common",
    bonuses: {},
  },
  plate_armor: {
    id: "plate_armor",
    catalogKind: "equipment",
    name: "Plate Armor",
    type: "equip",
    slot: "armor",
    material: "steel",
    rarity: 3,
    rarityName: "rare",
    bonuses: { defense: 3 },
  },
  // ── Body armor: epic ────────────────────────────────────────────
  armor_vanguard: {
    id: "armor_vanguard",
    catalogKind: "equipment",
    name: "Vanguard Plate",
    type: "equip",
    slot: "armor",
    material: "steel",
    rarity: 4,
    rarityName: "epic",
    bonuses: { defense: 4, maxHp: 15, bluntResist: 0.15, slashResist: 0.1 },
    description: "Forged in layers of folded steel, each plate interlocks to seal every gap.",
    affixes: ["shieldWall1"],
  },
  armor_nightstalker: {
    id: "armor_nightstalker",
    catalogKind: "equipment",
    name: "Nightstalker Vest",
    type: "equip",
    slot: "armor",
    material: "leather",
    rarity: 4,
    rarityName: "epic",
    bonuses: { defense: 2, attack: 2, critChance: 0.05, maxStamina: 10 },
    description: "Blackened leather fitted with hidden pockets and reinforced seams for silent kills.",
    affixes: ["lucky1"],
  },
  armor_arcanist: {
    id: "armor_arcanist",
    catalogKind: "equipment",
    name: "Arcanist's Vestments",
    type: "equip",
    slot: "armor",
    material: "cloth",
    rarity: 4,
    rarityName: "epic",
    bonuses: { defense: 1, maxMana: 18, manaRegen: 0.5, spellHit: 2 },
    description: "Woven from thread soaked in moonwell water, it hums with latent power.",
    affixes: ["poisonWard1"],
  },
  // ── Body armor: legendary ───────────────────────────────────────
  armor_bulwark: {
    id: "armor_bulwark",
    catalogKind: "equipment",
    name: "Bulwark of the Fallen King",
    type: "equip",
    slot: "armor",
    material: "steel",
    rarity: 5,
    rarityName: "legendary",
    bonuses: { defense: 5, maxHp: 25, bluntResist: 0.2, slashResist: 0.15, pierceResist: 0.1 },
    description: "A relic of a kingdom lost beneath the earth. Its bearer becomes an immovable wall.",
    affixes: ["shieldWall1", "kineticWard1"],
  },
  armor_phantom: {
    id: "armor_phantom",
    catalogKind: "equipment",
    name: "Phantom Harness",
    type: "equip",
    slot: "armor",
    material: "leather",
    rarity: 5,
    rarityName: "legendary",
    bonuses: { defense: 3, attack: 3, critChance: 0.08, maxStamina: 12, luck: 2 },
    description: "Stitched from the hides of shadow panthers, it shifts with the wearer like a second skin.",
    affixes: ["secondWind1"],
  },
  boots_plate: {
    id: "boots_plate",
    catalogKind: "equipment",
    name: "Steel Greaves",
    type: "equip",
    slot: "feet",
    material: "steel",
    rarity: 2,
    rarityName: "magic",
    bonuses: { defense: 2 },
  },
  // ── Feet: rare ──────────────────────────────────────────────────
  boots_ironshod: {
    id: "boots_ironshod",
    catalogKind: "equipment",
    name: "Ironshod Boots",
    type: "equip",
    slot: "feet",
    material: "iron",
    rarity: 3,
    rarityName: "rare",
    bonuses: { defense: 3, maxHp: 5 },
    description: "Heavy boots with iron-capped toes. They make stealth impossible but survival likely.",
  },
  boots_strider: {
    id: "boots_strider",
    catalogKind: "equipment",
    name: "Strider Boots",
    type: "equip",
    slot: "feet",
    material: "leather",
    rarity: 3,
    rarityName: "rare",
    bonuses: { defense: 1, maxStamina: 8, staminaRegen: 0.5, luck: 1 },
    description: "Soft-soled boots favored by rangers and thieves for their sure grip.",
  },
  // ── Feet: epic ──────────────────────────────────────────────────
  boots_sentinel: {
    id: "boots_sentinel",
    catalogKind: "equipment",
    name: "Sentinel Sabatons",
    type: "equip",
    slot: "feet",
    material: "steel",
    rarity: 4,
    rarityName: "epic",
    bonuses: { defense: 3, maxHp: 10, bluntResist: 0.1, pierceResist: 0.1 },
    description: "Steel-plated boots with articulated ankles, built for warriors who hold the line.",
    affixes: ["kineticWard1"],
  },
  boots_shadowstep: {
    id: "boots_shadowstep",
    catalogKind: "equipment",
    name: "Shadowstep Boots",
    type: "equip",
    slot: "feet",
    material: "leather",
    rarity: 4,
    rarityName: "epic",
    bonuses: { defense: 2, attack: 1, critChance: 0.04, maxStamina: 10, staminaRegen: 0.4 },
    description: "Each step bends light around the wearer, leaving only a blur.",
    affixes: ["lucky1"],
  },
  boots_conduit: {
    id: "boots_conduit",
    catalogKind: "equipment",
    name: "Conduit Slippers",
    type: "equip",
    slot: "feet",
    material: "cloth",
    rarity: 4,
    rarityName: "epic",
    bonuses: { defense: 1, maxMana: 12, manaRegen: 0.4, spellHit: 1 },
    description: "Silk slippers that draw ambient mana upward through the soles.",
    affixes: ["life1"],
  },
  // ── Feet: legendary ─────────────────────────────────────────────
  boots_earthbound: {
    id: "boots_earthbound",
    catalogKind: "equipment",
    name: "Earthbound Greaves",
    type: "equip",
    slot: "feet",
    material: "steel",
    rarity: 5,
    rarityName: "legendary",
    bonuses: { defense: 4, maxHp: 15, bluntResist: 0.15, pierceResist: 0.1 },
    description: "Forged from ore pulled from the deepest vein, they root the wearer to the earth itself.",
    affixes: ["shieldWall1"],
  },
  boots_phantomstride: {
    id: "boots_phantomstride",
    catalogKind: "equipment",
    name: "Phantomstride Boots",
    type: "equip",
    slot: "feet",
    material: "leather",
    rarity: 5,
    rarityName: "legendary",
    bonuses: { defense: 2, attack: 2, critChance: 0.06, maxStamina: 15, staminaRegen: 0.5, luck: 2 },
    description: "Worn by the last of the ghost rangers. Their footprints never touch the ground.",
    affixes: ["guard1"],
  },
  shield_steel: {
    id: "shield_steel",
    catalogKind: "equipment",
    name: "Steel Shield",
    type: "equip",
    slot: "offhand",
    material: "steel",
    rarity: 2,
    rarityName: "magic",
    bonuses: { defense: 3 },
  },

  // Early proc gear (tier 0-1)
  sparking_knife: {
    id: "sparking_knife",
    catalogKind: "equipment",
    name: "Sparking Knife",
    type: "equip",
    slot: "weapon",
    material: "steel",
    rarity: 2,
    rarityName: "magic",
    bonuses: { attack: 1 },
    damageDice: "1d4",
    staminaCost: 5,
    description: "A tarnished blade that crackles faintly when swung.",
    affixes: ["chainLightning1"],
  },
  smoldering_club: {
    id: "smoldering_club",
    catalogKind: "equipment",
    name: "Smoldering Club",
    type: "equip",
    slot: "weapon",
    material: "wood",
    rarity: 2,
    rarityName: "magic",
    bonuses: { attack: 1 },
    damageDice: "1d6",
    damageType: "blunt",
    staminaCost: 9,
    description: "The charred head still glows with fading embers.",
    affixes: ["firestorm1"],
  },
  chipped_fang: {
    id: "chipped_fang",
    catalogKind: "equipment",
    name: "Chipped Fang",
    type: "equip",
    slot: "weapon",
    material: "bone",
    rarity: 2,
    rarityName: "magic",
    bonuses: { attack: 1, critChance: 0.03 },
    damageDice: "1d4",
    staminaCost: 5,
    description: "A sharpened tooth pried from something large. It draws blood easily.",
    affixes: ["hemorrhage1"],
  },
  leech_blade: {
    id: "leech_blade",
    catalogKind: "equipment",
    name: "Leech Blade",
    type: "equip",
    slot: "weapon",
    material: "iron",
    rarity: 2,
    rarityName: "magic",
    bonuses: { attack: 1 },
    damageDice: "1d6",
    staminaCost: 8,
    description: "Dark stains run the length of the fuller. The grip feels oddly warm.",
    affixes: ["soulDrain1"],
  },
  rusted_buckler: {
    id: "rusted_buckler",
    catalogKind: "equipment",
    name: "Rusted Buckler",
    type: "equip",
    slot: "offhand",
    material: "iron",
    rarity: 2,
    rarityName: "magic",
    bonuses: { defense: 1 },
    description: "Dented and pitted, but it still hardens when struck.",
    affixes: ["shieldWall1"],
  },
  brawler_band: {
    id: "brawler_band",
    catalogKind: "equipment",
    name: "Brawler's Band",
    type: "equip",
    slot: "ring",
    material: "iron",
    rarity: 2,
    rarityName: "magic",
    bonuses: {},
    description: "A crude iron ring. Your blood runs hot when you wear it.",
    affixes: ["berserk1"],
  },

  // Flaming weapon line (early / mid / late)
  ember_knife: {
    id: "ember_knife",
    catalogKind: "equipment",
    name: "Ember Knife",
    type: "equip",
    slot: "weapon",
    material: "iron",
    rarity: 2,
    rarityName: "magic",
    bonuses: { attack: 1 },
    damageDice: "1d4",
    staminaCost: 5,
    description: "The blade radiates a faint heat. Even unsheathed it casts a dim orange glow.",
    affixes: ["flaming"],
  },
  flametongue: {
    id: "flametongue",
    catalogKind: "equipment",
    name: "Flametongue",
    type: "equip",
    slot: "weapon",
    material: "steel",
    rarity: 3,
    rarityName: "rare",
    bonuses: { attack: 2 },
    damageDice: "1d6",
    staminaCost: 8,
    description: "Tongues of fire lick along the edge on every swing. They never go out.",
    affixes: ["flaming"],
  },
  ashen_reaver: {
    id: "ashen_reaver",
    catalogKind: "equipment",
    name: "Ashen Reaver",
    type: "equip",
    slot: "weapon",
    material: "steel",
    rarity: 4,
    rarityName: "epic",
    bonuses: { attack: 3, critChance: 0.04 },
    damageDice: "1d8",
    staminaCost: 11,
    description: "Forged in a volcanic rift. The blade smoulders with a deep red glow that nothing can extinguish.",
    affixes: ["flaming"],
  },

  // Epic proc gear (tier 2-3)
  pyreheart_mace: {
    id: "pyreheart_mace",
    catalogKind: "equipment",
    name: "Pyreheart Mace",
    type: "equip",
    slot: "weapon",
    material: "iron",
    rarity: 4,
    rarityName: "epic",
    bonuses: { attack: 2 },
    damageDice: "1d8",
    damageType: "blunt",
    staminaCost: 10,
    description: "The head glows cherry-red, leaving scorch marks on everything it strikes.",
    affixes: ["firestorm1", "stunning1"],
  },
  glacial_edge: {
    id: "glacial_edge",
    catalogKind: "equipment",
    name: "Glacial Edge",
    type: "equip",
    slot: "weapon",
    material: "steel",
    rarity: 4,
    rarityName: "epic",
    bonuses: { attack: 2, critChance: 0.05 },
    damageDice: "1d6",
    staminaCost: 8,
    description: "A blade of pale blue steel that numbs flesh and opens veins.",
    affixes: ["frostbite1", "hemorrhage1"],
  },
  ring_of_fury: {
    id: "ring_of_fury",
    catalogKind: "equipment",
    name: "Warband Ring",
    type: "equip",
    slot: "ring",
    material: "gold",
    rarity: 4,
    rarityName: "epic",
    bonuses: { critChance: 0.05 },
    description: "A rough gold band etched with battle runes. It pulses warmly in combat.",
    affixes: ["berserk1", "manaSurge1"],
  },
  witchfire_sword: {
    id: "witchfire_sword",
    catalogKind: "equipment",
    name: "Witchfire Sword",
    type: "equip",
    slot: "weapon",
    material: "steel",
    rarity: 4,
    rarityName: "epic",
    bonuses: { attack: 2, critChance: 0.03 },
    damageDice: "1d8",
    staminaCost: 9,
    description: "Green flame licks along the edge, draining warmth from the air.",
    affixes: ["firestorm1", "soulDrain1"],
  },
  howling_maul: {
    id: "howling_maul",
    catalogKind: "equipment",
    name: "Howling Maul",
    type: "equip",
    slot: "weapon",
    material: "iron",
    rarity: 4,
    rarityName: "epic",
    twoHanded: true,
    bonuses: { attack: 3 },
    damageDice: "1d10",
    damageType: "blunt",
    staminaCost: 12,
    description: "The wind screams through holes bored in the hammerhead.",
    affixes: ["hemorrhage1", "berserk1", "stunning1"],
  },
  wardkeeper_shield: {
    id: "wardkeeper_shield",
    catalogKind: "equipment",
    name: "Wardkeeper Shield",
    type: "equip",
    slot: "offhand",
    material: "steel",
    rarity: 4,
    rarityName: "epic",
    bonuses: { defense: 2, kineticDR: 1 },
    description: "Runes flare across its face when danger is near.",
    affixes: ["shieldWall1", "guard1"],
  },
  serpent_ring: {
    id: "serpent_ring",
    catalogKind: "equipment",
    name: "Serpent Coil",
    type: "equip",
    slot: "ring",
    material: "silver",
    rarity: 4,
    rarityName: "epic",
    bonuses: { manaRegen: 0.15 },
    description: "A silver band shaped like a biting snake. Its eyes glint with cunning.",
    affixes: ["manaSurge1", "frostbite1"],
  },
  // ── Rings: legendary ────────────────────────────────────────────
  ring_ironwill: {
    id: "ring_ironwill",
    catalogKind: "equipment",
    name: "Ring of Iron Will",
    type: "equip",
    slot: "ring",
    material: "gold",
    rarity: 5,
    rarityName: "legendary",
    bonuses: { maxHp: 15, defense: 2, bluntResist: 0.1, poisonResist: 0.1 },
    description: "A band of hardened gold inlaid with runes of fortitude. The wearer shrugs off what would fell lesser mortals.",
    affixes: ["life1"],
  },
  ring_fateweaver: {
    id: "ring_fateweaver",
    catalogKind: "equipment",
    name: "Fateweaver's Band",
    type: "equip",
    slot: "ring",
    material: "gold",
    rarity: 5,
    rarityName: "legendary",
    bonuses: { critChance: 0.08, critMult: 0.15, attack: 1, luck: 3 },
    description: "Fate bends around this ring like light around a star. Every strike finds its mark.",
    affixes: ["berserk1"],
  },
  ring_voidchannel: {
    id: "ring_voidchannel",
    catalogKind: "equipment",
    name: "Voidchannel Ring",
    type: "equip",
    slot: "ring",
    material: "silver",
    rarity: 5,
    rarityName: "legendary",
    bonuses: { maxMana: 15, manaRegen: 0.4, spellHit: 2, critChance: 0.04 },
    description: "The gem at its center is not a stone but a window into the void, from which raw mana pours.",
    affixes: ["manaSurge1"],
  },

  // Legendary proc gear (tier 3+)
  stormcaller_blade: {
    id: "stormcaller_blade",
    catalogKind: "equipment",
    name: "Stormcaller",
    type: "equip",
    slot: "weapon",
    material: "steel",
    rarity: 5,
    rarityName: "legendary",
    bonuses: { attack: 3, critChance: 0.05 },
    damageDice: "1d8",
    staminaCost: 9,
    description: "Arcs of lightning dance along the blade. Thunder rumbles with each swing.",
    affixes: ["chainLightning1", "capacitive1"],
  },
  soulreaver_axe: {
    id: "soulreaver_axe",
    catalogKind: "equipment",
    name: "Soulreaver",
    type: "equip",
    slot: "weapon",
    material: "iron",
    rarity: 5,
    rarityName: "legendary",
    twoHanded: true,
    bonuses: { attack: 4 },
    damageDice: "2d6",
    staminaCost: 14,
    description: "A blackened axe that drinks deeply from the wounded.",
    affixes: ["soulDrain1", "executioner1"],
  },
  aegis_of_the_ancient: {
    id: "aegis_of_the_ancient",
    catalogKind: "equipment",
    name: "Aegis of the Ancient",
    type: "equip",
    slot: "offhand",
    material: "iron",
    rarity: 5,
    rarityName: "legendary",
    bonuses: { defense: 3, kineticDR: 2 },
    description: "A tower shield inscribed with forgotten wards. It hums when struck.",
    affixes: ["shieldWall1", "secondWind1"],
  },

  // Magic / Usable
  stone_touchstone: {
    id: "stone_touchstone",
    catalogKind: "magic",
    name: "Touchstone",
    type: "tool",
    slot: "bag",
    material: "mineral",
    rarity: 1,
    rarityName: "common",
    value: 45,
    weight: 10,
    description: "A gray stone used to identify gem quality by streak and hardness.",
    hooks: {
      can_dip_target: canTouchstoneDipTarget,
      on_dip: createTouchstoneDipHook(),
    },
  },
  potion_poison: {
    id: "potion_poison",
    catalogKind: "magic",
    name: "Potion of Poison",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 1,
    rarityName: "common",
    value: 20,
    coating_color: "#66dd66",
    description: "A toxic brew that can be used to coat a weapon.",
    potion: {
      route: "oral",
      doses: 1,
      channels: [],
      effects: [],
      toxicity: null,
      feel: "It tastes acrid and vile.",
    },
    hooks: {
      can_dip_target: canPoisonDipTarget,
      on_dip: createPoisonCoatDipHook({
        chargesGranted: 12,
        coatingColor: "#66dd66",
        messageTemplate: "You coat $targetName with poison (+$chargesGranted charges, total $chargesTotal).",
      }),
      on_throw: createPoisonCloudThrowHook({
        turnsLeft: 3,
        radius: 1,
        tickDamage: 2,
        medium: "floor",
      }),
    },
  },
  potion_water: {
    id: "potion_water",
    catalogKind: "magic",
    name: "Potion of Water",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 1,
    rarityName: "common",
    value: 12,
    description: "Clear water in a fragile vial. Useful for quenching, blessing, and splashing.",
    potion: {
      route: "oral",
      doses: 1,
      channels: [],
      effects: [],
      toxicity: null,
      beatitude: "uncursed",
      feel: "It tastes like plain water.",
    },
    hooks: createWaterPotionHooks(),
  },
  potion_holy_water: {
    id: "potion_holy_water",
    catalogKind: "magic",
    name: "Vial of Holy Water",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 2,
    rarityName: "magic",
    value: 30,
    description: "Consecrated water that purges flame and carries a blessing.",
    potion: {
      route: "oral",
      doses: 1,
      channels: [],
      effects: [],
      toxicity: null,
      beatitude: "blessed",
      feel: "It tastes pure and faintly warm.",
    },
    hooks: createWaterPotionHooks(),
  },
  potion_stoneskin: {
    id: "potion_stoneskin",
    catalogKind: "magic",
    name: "Potion of Stoneskin",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 2,
    rarityName: "magic",
    value: 60,
    description: "Turns skin to granite, can harden gear, and can shatter into a taunting statue.",
    potion: {
      route: "oral",
      doses: 1,
      channels: [],
      effects: [],
      toxicity: null,
      feel: "Your skin prickles and feels curiously heavy.",
    },
    hooks: {
      can_dip_target: canStonecoatDipTarget,
      on_drink: (ctx, state) => {
        const actorId = Number(state?.actor || ctx.actor || 0) | 0;
        const targetId = ctx.rules.resolveTarget(actorId);
        const turns = ctx.helpers.int(30, 40);
        const potency = ctx.helpers.int(2, 3);
        ctx.helpers.addEffect(targetId, {
          key: "stoneskin",
          potency,
          turnsLeft: turns,
          onsetLeft: 0,
          peakLeft: 0,
          stack: "refresh",
          maxStacks: 1,
          sourceId: Number(state?.itemId || ctx.primary || 0) | 0,
          meta: { source: "potion_stoneskin", kind: "armor_buff", masked: !state.identified },
        });
        ctx.io.emit("status", createStatusEvent({ id: targetId, kind: "buff", effect: "stoneskin", source: actorId, masked: !state.identified }));
        return { turns, potency };
      },
      on_throw: (ctx, state) => {
        const actorId = Number(state?.actor || ctx.actor || 0) | 0;
        const throwSpec = (state?.throw && typeof state.throw === "object") ? state.throw : null;
        const fallbackPoint = ctx.helpers.adjacentPoint(actorId);
        const rawLandingX = Number(throwSpec?.to?.x ?? state?.targetX);
        const rawLandingY = Number(throwSpec?.to?.y ?? state?.targetY);
        const spawnAt = {
          x: Number.isFinite(rawLandingX) ? (rawLandingX | 0) : (fallbackPoint.x | 0),
          y: Number.isFinite(rawLandingY) ? (rawLandingY | 0) : (fallbackPoint.y | 0),
        };
        const rawFromX = Number(throwSpec?.from?.x);
        const rawFromY = Number(throwSpec?.from?.y);
        const from = (
          Number.isFinite(rawFromX) && Number.isFinite(rawFromY)
            ? { x: rawFromX | 0, y: rawFromY | 0 }
            : null
        );
        const taunts = [
          "A stone statue lurches upright and starts heckling you.",
          "The shattered potion hardens into a taunting idol.",
          "Granite dust spirals into a jeering stone sentinel.",
        ];
        const tauntMessage = ctx.helpers.pick(taunts, taunts[0]);
        ctx.helpers.spawnMonster("stone_taunter", spawnAt, {
          name: "Taunting Statue",
          faction: "stone_taunter",
          tauntMessage,
        });
        ctx.io.emit("item:thrown", {
          actor: actorId,
          itemId: Number(state?.itemId || ctx.primary || 0) | 0,
          targetId: Number(state?.targetId || ctx.target || 0) | 0,
          from,
          to: { x: spawnAt.x, y: spawnAt.y },
          range: Number.isFinite(Number(throwSpec?.range)) ? (Number(throwSpec.range) | 0) : null,
          maxRange: Number.isFinite(Number(throwSpec?.maxRange)) ? (Number(throwSpec.maxRange) | 0) : null,
          weight: Number.isFinite(Number(throwSpec?.weight)) ? Number(throwSpec.weight) : null,
          path: "itemHooks",
          result: { type: "stone_statue" },
        });
        return { consumed: true, spawned: "stone_taunter", at: spawnAt };
      },
      on_dip: (ctx, state) => {
        const actor = Number(state?.actor || ctx.actor || 0) | 0;
        const toolId = Number(state?.toolId || ctx.primary || 0) | 0;
        const targetId = Number(state?.targetId || ctx.target || 0) | 0;
        const acBonus = 1;
        if (!(targetId > 0) || !ctx.query.alive(targetId)) {
          return { applied: false, consumedTool: false, resultType: "nothing" };
        }

        const info = ctx.query.itemInfo(targetId);
        const bonuses = (info?.bonuses && typeof info.bonuses === "object")
          ? { ...info.bonuses }
          : {};
        const baseDefense = Number(bonuses.defense || 0);
        bonuses.defense = baseDefense + acBonus;
        const targetName = resolveApplyTargetName(ctx, state, "item");
        const acText = acBonus > 0 ? `+${acBonus}` : `${acBonus}`;

        ctx.helpers.setMaterial(targetId, "stone");
        ctx.helpers.patchItemInfo(targetId, {
          bonuses,
          description: `${String(info?.description || "Item")} Its surface is plated with living stone.`,
        });
        ctx.io.emit("item:applied", {
          actor,
          toolId,
          targetId,
          result: {
            type: "stonecoat",
            acBonus,
            defenseBonus: acBonus,
            message: `You harden ${targetName} into living stone (AC ${acText}).`,
          },
        });
        return { applied: true, consumedTool: true, resultType: "stonecoat" };
      },
    },
  },
  potion_vigor: {
    id: "potion_vigor",
    catalogKind: "magic",
    name: "Potion of Vigor",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 2,
    rarityName: "magic",
    value: 40,
    description: "A crimson draught that mends wounds in a single heartbeat.",
    potion: {
      route: "oral",
      doses: 1,
      channels: [],
      effects: [],
      toxicity: null,
      feel: "Your wounds knit closed with a rush of heat.",
    },
    hooks: {
      on_drink: (ctx, state) => {
        const targetId = ctx.rules.resolveTarget(Number(state?.actor || ctx.actor || 0) | 0);
        const vit = ctx.query.get(targetId, Vitality);
        if (!vit) return { healed: 0 };
        const amount = Math.max(1, Math.floor(vit.maxHp * 0.25));
        ctx.helpers.heal(targetId, amount);
        return { healed: amount };
      },
    },
  },
  potion_adrenaline: {
    id: "potion_adrenaline",
    catalogKind: "magic",
    name: "Potion of Adrenaline",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 2,
    rarityName: "magic",
    value: 45,
    description: "A jolt of pure energy that instantly restores all stamina.",
    potion: {
      route: "oral",
      doses: 1,
      channels: [],
      effects: [],
      toxicity: null,
      feel: "Your heart pounds with sudden, explosive energy.",
    },
    hooks: {
      on_drink: (ctx, state) => {
        const targetId = ctx.rules.resolveTarget(Number(state?.actor || ctx.actor || 0) | 0);
        const stam = ctx.query.get(targetId, Stamina);
        if (!stam) return { restored: 0 };
        const maxBonus = Number(getPassiveBonuses(ctx.world, targetId)?.maxStaminaDerived ?? 0);
        const cap = stam.maxStamina + maxBonus;
        const before = stam.stamina;
        stam.stamina = cap;
        return { restored: stam.stamina - before };
      },
    },
  },
  potion_mana: {
    id: "potion_mana",
    catalogKind: "magic",
    name: "Mana Potion",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 2,
    rarityName: "magic",
    value: 50,
    description: "A shimmering azure elixir that instantly restores all mana.",
    potion: {
      route: "oral",
      doses: 1,
      channels: [],
      effects: [],
      toxicity: null,
      feel: "Your mind buzzes with arcane static.",
    },
    hooks: {
      on_drink: (ctx, state) => {
        const targetId = ctx.rules.resolveTarget(Number(state?.actor || ctx.actor || 0) | 0);
        const mana = ctx.query.get(targetId, Mana);
        if (!mana) return { restored: 0 };
        const maxBonus = Number(getPassiveBonuses(ctx.world, targetId)?.maxManaDerived ?? 0);
        const cap = mana.maxMana + maxBonus;
        const before = mana.mana;
        mana.mana = cap;
        return { restored: mana.mana - before };
      },
    },
  },
  potion_endurance: {
    id: "potion_endurance",
    catalogKind: "magic",
    name: "Potion of Endurance",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 2,
    rarityName: "magic",
    value: 35,
    description: "Liquid lightning that floods the muscles with stamina.",
    potion: {
      route: "oral",
      doses: 1,
      channels: [],
      effects: [
        { key: "stamina_restore", potency: 1, onset: 0, peak: 0, duration: 100,
          stack: "refresh", maxStacks: 1 },
      ],
      toxicity: null,
      feel: "Your muscles surge with newfound vigour.",
    },
  },
  potion_second_wind: {
    id: "potion_second_wind",
    catalogKind: "magic",
    name: "Potion of Second Wind",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 2,
    rarityName: "magic",
    value: 50,
    description: "A cool teal elixir that quickens stamina recovery for several turns.",
    potion: {
      route: "oral",
      doses: 1,
      channels: [],
      effects: [
        { key: "stamina_regen_boost", potency: 3, onset: 0, peak: 0, duration: 25,
          stack: "refresh", maxStacks: 1 },
      ],
      toxicity: null,
      feel: "Your lungs open; your breathing quickens and steadies.",
    },
  },
  potion_resist_fire: {
    id: "potion_resist_fire",
    catalogKind: "magic",
    name: "Potion of Fire Resistance",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 2,
    rarityName: "magic",
    value: 55,
    description: "An icy draught that coats the drinker in a shimmering heat ward.",
    potion: {
      route: "oral",
      doses: 1,
      channels: [],
      effects: [],
      toxicity: null,
      feel: "A cool wave washes over your body.",
    },
    hooks: {
      on_drink: (ctx, state) => {
        const targetId = ctx.rules.resolveTarget(Number(state?.actor || ctx.actor || 0) | 0);
        ctx.helpers.addEffect(targetId, {
          key: "resist_fire",
          potency: 0.3,
          turnsLeft: 40,
          onsetLeft: 0,
          peakLeft: 0,
          stack: "refresh",
          maxStacks: 1,
          sourceId: Number(state?.itemId || ctx.primary || 0) | 0,
          meta: { source: "potion_resist_fire", kind: "resist_buff", masked: !state.identified },
        });
        ctx.io.emit("status", createStatusEvent({ id: targetId, kind: "buff", effect: "resist_fire", source: Number(state?.actor || ctx.actor || 0) | 0, masked: !state.identified }));
        return { resist: "fire", duration: 40 };
      },
    },
  },
  potion_resist_poison: {
    id: "potion_resist_poison",
    catalogKind: "magic",
    name: "Potion of Poison Resistance",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 2,
    rarityName: "magic",
    value: 55,
    description: "A bitter emerald tonic that fortifies the body against toxins.",
    potion: {
      route: "oral",
      doses: 1,
      channels: [],
      effects: [],
      toxicity: null,
      feel: "It burns your throat with a sharp intensity.",
    },
    hooks: {
      on_drink: (ctx, state) => {
        const targetId = ctx.rules.resolveTarget(Number(state?.actor || ctx.actor || 0) | 0);
        ctx.helpers.addEffect(targetId, {
          key: "resist_poison",
          potency: 0.3,
          turnsLeft: 40,
          onsetLeft: 0,
          peakLeft: 0,
          stack: "refresh",
          maxStacks: 1,
          sourceId: Number(state?.itemId || ctx.primary || 0) | 0,
          meta: { source: "potion_resist_poison", kind: "resist_buff", masked: !state.identified },
        });
        ctx.io.emit("status", createStatusEvent({ id: targetId, kind: "buff", effect: "resist_poison", source: Number(state?.actor || ctx.actor || 0) | 0, masked: !state.identified }));
        return { resist: "poison", duration: 40 };
      },
    },
  },
  potion_anti_venom: {
    id: "potion_anti_venom",
    catalogKind: "magic",
    name: "Anti-Venom",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 2,
    rarityName: "magic",
    value: 40,
    description: "A milky white serum that instantly neutralises all poisons in the body.",
    potion: {
      route: "oral",
      doses: 1,
      channels: [],
      effects: [],
      toxicity: null,
      feel: "It tastes medicinal and faintly chalky.",
    },
    hooks: {
      on_drink: (ctx, state) => {
        const actorId = Number(state?.actor || ctx.actor || 0) | 0;
        const targetId = ctx.rules.resolveTarget(actorId);
        const hadPoison = ctx.helpers.hasStatus(targetId, "poisoned") || ctx.helpers.hasStatus(targetId, "poison");
        ctx.helpers.clearEffects(targetId, ["poison", "poisoned"]);
        if (hadPoison) {
          ctx.io.emit("status", createStatusEvent({ id: targetId, kind: "cure", effect: "poison", source: actorId }));
        }
        return { cured: hadPoison ? "poison" : "none" };
      },
    },
  },
  potion_resist_electric: {
    id: "potion_resist_electric",
    catalogKind: "magic",
    name: "Potion of Lightning Resistance",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 2,
    rarityName: "magic",
    value: 55,
    description: "A crackling blue elixir that grounds the drinker against electrical surges.",
    potion: {
      route: "oral",
      doses: 1,
      channels: [],
      effects: [],
      toxicity: null,
      feel: "A faint tingle runs over your skin.",
    },
    hooks: {
      on_drink: (ctx, state) => {
        const targetId = ctx.rules.resolveTarget(Number(state?.actor || ctx.actor || 0) | 0);
        ctx.helpers.addEffect(targetId, {
          key: "resist_electric",
          potency: 0.3,
          turnsLeft: 40,
          onsetLeft: 0,
          peakLeft: 0,
          stack: "refresh",
          maxStacks: 1,
          sourceId: Number(state?.itemId || ctx.primary || 0) | 0,
          meta: { source: "potion_resist_electric", kind: "resist_buff", masked: !state.identified },
        });
        ctx.io.emit("status", createStatusEvent({ id: targetId, kind: "buff", effect: "resist_electric", source: Number(state?.actor || ctx.actor || 0) | 0, masked: !state.identified }));
        return { resist: "electric", duration: 40 };
      },
    },
  },
  potion_resist_acid: {
    id: "potion_resist_acid",
    catalogKind: "magic",
    name: "Potion of Acid Resistance",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 2,
    rarityName: "magic",
    value: 55,
    description: "A thick amber syrup that shields the skin from corrosive burns.",
    potion: {
      route: "oral",
      doses: 1,
      channels: [],
      effects: [],
      toxicity: null,
      feel: "It coats your throat with a thick, amber warmth.",
    },
    hooks: {
      on_drink: (ctx, state) => {
        const targetId = ctx.rules.resolveTarget(Number(state?.actor || ctx.actor || 0) | 0);
        ctx.helpers.addEffect(targetId, {
          key: "resist_acid",
          potency: 0.3,
          turnsLeft: 40,
          onsetLeft: 0,
          peakLeft: 0,
          stack: "refresh",
          maxStacks: 1,
          sourceId: Number(state?.itemId || ctx.primary || 0) | 0,
          meta: { source: "potion_resist_acid", kind: "resist_buff", masked: !state.identified },
        });
        ctx.io.emit("status", createStatusEvent({ id: targetId, kind: "buff", effect: "resist_acid", source: Number(state?.actor || ctx.actor || 0) | 0, masked: !state.identified }));
        return { resist: "acid", duration: 40 };
      },
    },
  },
  book_lightning: {
    id: "book_lightning",
    catalogKind: "magic",
    name: "Spellbook of Lightning",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 3,
    rarityName: "rare",
    description: "Grants the ability to cast a lightning spell.",
    hooks: {
      on_use: createLearnSpellFromIdentityHook({
        identityPrefix: "book_",
        consumeOnSuccess: true,
      }),
    },
  },
  book_meteor: {
    id: "book_meteor",
    catalogKind: "magic",
    name: "Spellbook of Meteor",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 4,
    rarityName: "epic",
    description: "Grants the ability to cast a meteor spell.",
    hooks: {
      on_use: createLearnSpellFromIdentityHook({
        identityPrefix: "book_",
        consumeOnSuccess: true,
      }),
    },
  },
  book_blastwave: {
    id: "book_blastwave",
    catalogKind: "magic",
    name: "Spellbook of Blast Wave",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 2,
    rarityName: "magic",
    description: "Grants the ability to cast a blast wave spell.",
    hooks: {
      on_use: createLearnSpellFromIdentityHook({
        identityPrefix: "book_",
        consumeOnSuccess: true,
      }),
    },
  },
  book_earthshatter: {
    id: "book_earthshatter",
    catalogKind: "magic",
    name: "Spellbook of Earthshatter",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 2,
    rarityName: "magic",
    description: "Grants the ability to cast Earthshatter, cracking the ground to stun nearby foes.",
    hooks: {
      on_use: createLearnSpellFromIdentityHook({
        identityPrefix: "book_",
        consumeOnSuccess: true,
      }),
    },
  },
  book_blink: {
    id: "book_blink",
    catalogKind: "magic",
    name: "Spellbook of Blink",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 2,
    rarityName: "magic",
    description: "Grants the ability to cast Blink.",
    hooks: {
      on_use: createLearnSpellFromIdentityHook({
        identityPrefix: "book_",
        consumeOnSuccess: true,
      }),
    },
  },
  book_frost: {
    id: "book_frost",
    catalogKind: "magic",
    name: "Spellbook of Frost",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 2,
    rarityName: "magic",
    description: "Grants the ability to cast Frost.",
    hooks: {
      on_use: createLearnSpellFromIdentityHook({
        identityPrefix: "book_",
        consumeOnSuccess: true,
      }),
    },
  },
  book_blizzard: {
    id: "book_blizzard",
    catalogKind: "magic",
    name: "Spellbook of Blizzard",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 3,
    rarityName: "rare",
    description: "Grants the ability to cast Blizzard.",
    hooks: {
      on_use: createLearnSpellFromIdentityHook({
        identityPrefix: "book_",
        consumeOnSuccess: true,
      }),
    },
  },
  book_firestorm: {
    id: "book_firestorm",
    catalogKind: "magic",
    name: "Spellbook of Firestorm",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 3,
    rarityName: "rare",
    description: "Grants the ability to cast Firestorm.",
    hooks: {
      on_use: createLearnSpellFromIdentityHook({
        identityPrefix: "book_",
        consumeOnSuccess: true,
      }),
    },
  },
  book_heal: {
    id: "book_heal",
    catalogKind: "magic",
    name: "Spellbook of Healing",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 2,
    rarityName: "magic",
    description: "Grants the ability to cast a healing spell.",
    hooks: {
      on_use: createLearnSpellFromIdentityHook({
        identityPrefix: "book_",
        consumeOnSuccess: true,
      }),
    },
  },
  book_blind: {
    id: "book_blind",
    catalogKind: "magic",
    name: "Spellbook of Blindness",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 3,
    rarityName: "rare",
    description: "Grants the ability to cast a blinding spell.",
    hooks: {
      on_use: createLearnSpellFromIdentityHook({
        identityPrefix: "book_",
        consumeOnSuccess: true,
      }),
    },
  },
  book_verdant_ward: {
    id: "book_verdant_ward",
    catalogKind: "magic",
    name: "Spellbook of Verdant Ward",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 3,
    rarityName: "rare",
    description: "Grants the ability to cast Verdant Ward.",
    hooks: {
      on_use: createLearnSpellFromIdentityHook({
        identityPrefix: "book_",
        consumeOnSuccess: true,
      }),
    },
  },
  book_harmony_ward: {
    id: "book_harmony_ward",
    catalogKind: "magic",
    name: "Spellbook of Harmony Ward",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 3,
    rarityName: "rare",
    description: "Grants the ability to cast Harmony Ward.",
    hooks: {
      on_use: createLearnSpellFromIdentityHook({
        identityPrefix: "book_",
        consumeOnSuccess: true,
      }),
    },
  },
  book_shadow_veil: {
    id: "book_shadow_veil",
    catalogKind: "magic",
    name: "Spellbook of Shadow Veil",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 3,
    rarityName: "rare",
    description: "Grants the ability to cast Shadow Veil.",
    hooks: {
      on_use: createLearnSpellFromIdentityHook({
        identityPrefix: "book_",
        consumeOnSuccess: true,
      }),
    },
  },
  book_dead: {
    id: "book_dead",
    catalogKind: "magic",
    name: "Book of the Dead",
    type: "book",
    slot: "bag",
    material: "paper",
    rarity: 3,
    rarityName: "legendary",
    description: "An ancient tome bound in pale leather. It records the fate of every hero who came before.",
    hooks: {
      on_use: (ctx, state) => {
        const actor = Number(state?.actor || ctx.actor || 0) | 0;
        ctx.io.emit("deathlog:open", { actor });
        return { consumed: false };
      },
    },
  },
  book_kitty: {
    id: "book_kitty",
    catalogKind: "magic",
    name: "On the Care of Dungeon Cats",
    type: "book",
    slot: "bag",
    material: "paper",
    rarity: 1,
    rarityName: "common",
    description: "A slim volume with claw marks on the cover.",
    flavorText: "Your kitty will follow you, fetch items, and flee when injured. It will also drop things at your feet unprompted. Do not question why. This is simply what cats do.",
    hooks: {
      on_use: createOpenFlavorBookHook(
        "On the Care of Dungeon Cats",
        "Your kitty will follow you, fetch items, and flee when injured. It will also drop things at your feet unprompted. Do not question why. This is simply what cats do.",
      ),
    },
  },
  book_snakes: {
    id: "book_snakes",
    catalogKind: "magic",
    name: "Snake Nest Husbandry",
    type: "book",
    slot: "bag",
    material: "paper",
    rarity: 1,
    rarityName: "common",
    description: "Smells faintly of venom.",
    flavorText: "The snake trap releases a cluster of serpents when triggered. Venomous fangs, 25% poison chance. They appear from nowhere. Do not ask where they were hiding.",
    hooks: {
      on_use: createOpenFlavorBookHook(
        "Snake Nest Husbandry",
        "The snake trap releases a cluster of serpents when triggered. Venomous fangs, 25% poison chance. They appear from nowhere. Do not ask where they were hiding.",
      ),
    },
  },
  book_spikes: {
    id: "book_spikes",
    catalogKind: "magic",
    name: "The Spike Trap Quarterly, Vol. III",
    type: "book",
    slot: "bag",
    material: "paper",
    rarity: 1,
    rarityName: "common",
    description: "A trade publication for trap enthusiasts.",
    flavorText: "This season's models deliver a clean 35% of max HP in damage. Reader question: 'Can adventurers see them?' Editor's response: 'Not until it's too late.'",
    hooks: {
      on_use: createOpenFlavorBookHook(
        "The Spike Trap Quarterly, Vol. III",
        "This season's models deliver a clean 35% of max HP in damage. Reader question: 'Can adventurers see them?' Editor's response: 'Not until it's too late.'",
      ),
    },
  },
  book_touchstone: {
    id: "book_touchstone",
    catalogKind: "magic",
    name: "Touchstone: A Gemcutter's Manual",
    type: "book",
    slot: "bag",
    material: "paper",
    rarity: 1,
    rarityName: "common",
    description: "Dog-eared and well-thumbed.",
    flavorText: "Rub the stone across the touchstone. A hard white streak means value. A dull scratch means you've been carrying glass through fifteen floors of dungeon.",
    hooks: {
      on_use: createOpenFlavorBookHook(
        "Touchstone: A Gemcutter's Manual",
        "Rub the stone across the touchstone. A hard white streak means value. A dull scratch means you've been carrying glass through fifteen floors of dungeon.",
      ),
    },
  },
  book_corpses: {
    id: "book_corpses",
    catalogKind: "magic",
    name: "On Eating Monster Corpses",
    type: "book",
    slot: "bag",
    material: "paper",
    rarity: 1,
    rarityName: "common",
    description: "Several pages are stained with something unidentifiable.",
    flavorText: "Rat corpse: disease. Snake corpse: poison. Spider corpse: also poison. Floating eye corpse: you forget who you are. There is a pattern here. Please notice it.",
    hooks: {
      on_use: createOpenFlavorBookHook(
        "On Eating Monster Corpses",
        "Rat corpse: disease. Snake corpse: poison. Spider corpse: also poison. Floating eye corpse: you forget who you are. There is a pattern here. Please notice it.",
      ),
    },
  },
  book_gridbugs: {
    id: "book_gridbugs",
    catalogKind: "magic",
    name: "A Field Guide to Grid Bugs",
    type: "book",
    slot: "bag",
    material: "paper",
    rarity: 1,
    rarityName: "common",
    description: "Illustrated with tiny diagrams of cardinal directions.",
    flavorText: "The grid bug moves only along cardinal axes. Nobody knows why. One theory suggests they are bound by an ancient curse. Another theory: they are just very stubborn.",
    hooks: {
      on_use: createOpenFlavorBookHook(
        "A Field Guide to Grid Bugs",
        "The grid bug moves only along cardinal axes. Nobody knows why. One theory suggests they are bound by an ancient curse. Another theory: they are just very stubborn.",
      ),
    },
  },
  scroll_blastwave: {
    id: "scroll_blastwave",
    catalogKind: "magic",
    name: "Scroll of Blast Wave",
    type: "scroll",
    slot: "bag",
    material: "paper",
    rarity: 2,
    rarityName: "magic",
    description: "Casts Blast Wave without learning it.",
    hooks: {
      on_use: createCastSpellFromIdentityHook({
        identityPrefix: "scroll_",
        targetMode: "self",
        consumeOnSuccess: true,
      }),
    },
  },
  hearthstone: {
    id: "hearthstone",
    catalogKind: "magic",
    name: "Hearthstone",
    type: "tool",
    slot: "bag",
    value: 88,
    material: "mineral",
    rarity: 3,
    rarityName: "unique",
    description: "A warm stone that remembers the way home. Channel your will to return to the surface.",
    hooks: (() => {
      const _castHook = createCastSpellFromIdentityHook({
        identityPrefix: "",
        targetMode: "self",
        consumeOnSuccess: false,
      });
      return {
        on_use: (ctx, state) => {
          const cd = ctx.query.get(state.itemId, ItemCooldown);
          if (cd && cd.turnsRemaining > 0) {
            ctx.io.message(`The hearthstone is still cooling down (${cd.turnsRemaining} turns).`, 'warning');
            return { consumed: false, cancelled: true, consumesTurn: false, code: 'ITEM_ON_COOLDOWN', message: 'Hearthstone is on cooldown.' };
          }
          return _castHook(ctx, state);
        },
        after_use: (ctx, state) => {
          ctx.mutate.queue({ type: 'setItemCooldown', entityId: state.itemId | 0, turns: 500 });
          return {};
        },
      };
    })(),
  },
  scroll_homecoming: {
    id: "scroll_homecoming",
    catalogKind: "magic",
    name: "Scroll of Homecoming",
    type: "scroll",
    slot: "bag",
    material: "paper",
    rarity: 2,
    rarityName: "magic",
    description: "Returns you to the surface (dungeon level 0).",
    hooks: {
      on_use: createCastSpellFromIdentityHook({
        identityPrefix: "scroll_",
        targetMode: "self",
        consumeOnSuccess: true,
      }),
      on_loot_roll: (ctx, _state) => {
        if (ctx?.playerItemIds?.has('hearthstone')) return { cancel: true };
        return {};
      }
    },
  },
  scroll_heal: {
    id: "scroll_heal",
    catalogKind: "magic",
    name: "Scroll of Healing",
    type: "scroll",
    slot: "bag",
    material: "paper",
    rarity: 1,
    rarityName: "common",
    description: "Casts a healing spell on yourself or an ally.",
    hooks: {
      on_use: createCastSpellFromIdentityHook({
        identityPrefix: "scroll_",
        targetMode: "target",
        consumeOnSuccess: true,
      }),
    },
  },
  scroll_summon_skeleton: {
    id: "scroll_summon_skeleton",
    catalogKind: "magic",
    name: "Scroll of Summon Skeleton",
    type: "scroll",
    slot: "bag",
    material: "paper",
    rarity: 2,
    rarityName: "magic",
    description: "Rip a skeleton from the earth to fight at your side.",
    hooks: {
      on_use: createCastSpellFromIdentityHook({
        identityPrefix: "scroll_",
        targetMode: "self",
        consumeOnSuccess: true,
      }),
    },
  },
  scroll_mapping: {
    id: "scroll_mapping",
    catalogKind: "magic",
    name: "Scroll of Mapping",
    type: "scroll",
    slot: "bag",
    material: "paper",
    rarity: 1,
    rarityName: "common",
    weight: 0.1,
    value: 100,
    description: "Reveals the entire dungeon map.",
    hooks: {
      on_use: MAPPING_ON_USE,
    },
  },
  wand_lightning: {
    id: "wand_lightning",
    catalogKind: "magic",
    name: "Wand of Lightning",
    type: "wand",
    slot: "ranged",
    material: "wood",
    charges: 3,
    rarity: 3,
    rarityName: "rare",
    description: "Zaps a bolt of chain lightning. 3 charges.",
    hooks: {
      on_use: createCastSpellFromIdentityHook({
        identityPrefix: "wand_",
        targetMode: "intentTarget",
        castEventSource: "wand",
        consumeOnSuccess: true,
      }),
    },
  },
  wand_meteor: {
    id: "wand_meteor",
    catalogKind: "magic",
    name: "Wand of Meteor",
    type: "wand",
    slot: "ranged",
    material: "wood",
    charges: 2,
    rarity: 4,
    rarityName: "epic",
    description: "Calls down a meteor. 2 charges.",
    hooks: {
      on_use: createCastSpellFromIdentityHook({
        identityPrefix: "wand_",
        targetMode: "intentTarget",
        castEventSource: "wand",
        consumeOnSuccess: true,
      }),
    },
  },
  wand_frost: {
    id: "wand_frost",
    catalogKind: "magic",
    name: "Wand of Frost",
    type: "wand",
    slot: "ranged",
    material: "wood",
    charges: 10,
    rarity: 2,
    rarityName: "magic",
    description: "Encases an enemy in frost, slowing them. Lighter foes freeze longer. 10 charges.",
    hooks: {
      on_use: createCastSpellFromIdentityHook({
        identityPrefix: "wand_",
        targetMode: "intentTarget",
        castEventSource: "wand",
        consumeOnSuccess: true,
      }),
    },
  },
  wand_heal: {
    id: "wand_heal",
    catalogKind: "magic",
    name: "Wand of Healing",
    type: "wand",
    slot: "ranged",
    material: "wood",
    charges: 8,
    rarity: 2,
    rarityName: "magic",
    description: "Restores health to yourself or an ally. 8 charges.",
    hooks: {
      on_use: createCastSpellFromIdentityHook({
        identityPrefix: "wand_",
        targetMode: "target",
        castEventSource: "wand",
        consumeOnSuccess: true,
      }),
    },
  },
  food_ration: {
    id: "food_ration",
    catalogKind: "food",
    name: "Ration",
    type: "food",
    slot: "bag",
    material: "organic",
    rarity: 1,
    rarityName: "common",
    weight: 1,
    value: 10,
    description: "A dry but filling travel ration.",
    hooks: {
      on_use: EAT_ON_USE,
    },
  },
  food_iron_ration: {
    id: "food_iron_ration",
    catalogKind: "food",
    name: "Iron Ration",
    type: "food",
    slot: "bag",
    material: "organic",
    rarity: 1,
    rarityName: "common",
    weight: 1.5,
    value: 25,
    description: "A well-preserved military ration. Very filling.",
    hooks: {
      on_use: EAT_ON_USE,
    },
  },
  food_wild_berries: {
    id: "food_wild_berries",
    catalogKind: "food",
    name: "Wild Berries",
    type: "food",
    slot: "bag",
    material: "organic",
    rarity: 1,
    rarityName: "common",
    weight: 0.2,
    value: 4,
    description: "A handful of sweet wild berries.",
    hooks: {
      on_use: EAT_ON_USE,
    },
  },
  food_wild_herbs: {
    id: "food_wild_herbs",
    catalogKind: "food",
    name: "Wild Herbs",
    type: "food",
    slot: "bag",
    material: "organic",
    rarity: 1,
    rarityName: "common",
    weight: 0.15,
    value: 3,
    description: "Fresh herbs with a sharp, earthy bite.",
    hooks: {
      on_use: EAT_ON_USE,
    },
  },
  food_wheat: {
    id: "food_wheat",
    catalogKind: "food",
    name: "Wheat",
    type: "food",
    slot: "bag",
    material: "organic",
    rarity: 1,
    rarityName: "common",
    weight: 0.3,
    value: 5,
    description: "A sheaf of golden wheat. Can be cooked into bread.",
    hooks: {
      on_use: EAT_ON_USE,
    },
  },
  food_carrot: {
    id: "food_carrot",
    catalogKind: "food",
    name: "Carrot",
    type: "food",
    slot: "bag",
    material: "organic",
    rarity: 1,
    rarityName: "common",
    weight: 0.4,
    value: 4,
    description: "A fresh carrot, pulled straight from the soil.",
    hooks: {
      on_use: EAT_ON_USE,
    },
  },
  food_corn: {
    id: "food_corn",
    catalogKind: "food",
    name: "Corn",
    type: "food",
    slot: "bag",
    material: "organic",
    rarity: 1,
    rarityName: "common",
    weight: 1.0,
    value: 8,
    description: "An ear of golden corn.",
    hooks: {
      on_use: EAT_ON_USE,
    },
  },
  ore_iron: {
    id: "ore_iron",
    catalogKind: "material",
    name: "Iron Ore",
    type: "material",
    slot: "bag",
    material: "iron",
    rarity: 1,
    rarityName: "common",
    weight: 2.0,
    value: 12,
    description: "A chunk of raw iron ore, heavy and rust-red.",
  },
  ore_coal: {
    id: "ore_coal",
    catalogKind: "material",
    name: "Coal",
    type: "material",
    slot: "bag",
    material: "mineral",
    rarity: 1,
    rarityName: "common",
    weight: 1.5,
    value: 6,
    description: "A lump of coal, black and crumbly.",
  },
  ore_stone: {
    id: "ore_stone",
    catalogKind: "material",
    name: "Stone Chip",
    type: "material",
    slot: "bag",
    material: "mineral",
    rarity: 1,
    rarityName: "common",
    weight: 1.0,
    value: 2,
    description: "A rough chip of grey stone.",
  },
  seed_wheat: {
    id: "seed_wheat",
    catalogKind: "seed",
    name: "Wheat Seeds",
    type: "seed",
    slot: "bag",
    material: "organic",
    rarity: 1,
    rarityName: "common",
    weight: 0.1,
    value: 2,
    description: "A handful of golden wheat seeds.",
  },
  seed_carrot: {
    id: "seed_carrot",
    catalogKind: "seed",
    name: "Carrot Seeds",
    type: "seed",
    slot: "bag",
    material: "organic",
    rarity: 1,
    rarityName: "common",
    weight: 0.1,
    value: 2,
    description: "Tiny carrot seeds ready to plant.",
  },
  seed_corn: {
    id: "seed_corn",
    catalogKind: "seed",
    name: "Corn Seeds",
    type: "seed",
    slot: "bag",
    material: "organic",
    rarity: 1,
    rarityName: "common",
    weight: 0.1,
    value: 2,
    description: "A few kernels of seed corn.",
  },
  reagent_thorn_pod: {
    id: "reagent_thorn_pod",
    catalogKind: "material",
    name: "Thorn Pods",
    type: "ingredient",
    slot: "bag",
    material: "organic",
    rarity: 1,
    rarityName: "common",
    weight: 0.2,
    value: 6,
    description: "Hardened thorn pods packed with sharp resin.",
  },
  reagent_venom_frond: {
    id: "reagent_venom_frond",
    catalogKind: "material",
    name: "Venom Fronds",
    type: "ingredient",
    slot: "bag",
    material: "organic",
    rarity: 1,
    rarityName: "common",
    weight: 0.2,
    value: 7,
    description: "Slick venom fronds that reek of bitter alkaloids.",
  },
  reagent_moonleaf: {
    id: "reagent_moonleaf",
    catalogKind: "material",
    name: "Moonleaf",
    type: "ingredient",
    slot: "bag",
    material: "organic",
    rarity: 1,
    rarityName: "common",
    weight: 0.15,
    value: 8,
    description: "Cool silver leaves prized for soothing brews.",
  },
  reagent_ember_root: {
    id: "reagent_ember_root",
    catalogKind: "material",
    name: "Ember Root",
    type: "ingredient",
    slot: "bag",
    material: "organic",
    rarity: 1,
    rarityName: "common",
    weight: 0.2,
    value: 8,
    description: "A hot, peppery root that keeps its heat long after harvest.",
  },
  // ── Scroll of Identify ─────────────────────────────────────────────
  scroll_identify: {
    id: "scroll_identify",
    catalogKind: "magic",
    name: "Scroll of Identify",
    type: "scroll",
    slot: "bag",
    material: "paper",
    rarity: 1,
    rarityName: "common",
    weight: 0.1,
    value: 30,
    description: "Reveals the true nature of an item.",
    hooks: {
      can_dip_target: (state) => {
        const targetInfo = state?.targetInfo;
        if (!targetInfo) return false;
        const identity = String(state?.targetIdentity || "");
        if (!identity) return false;
        if (isIdentified(identity)) return false;
        return requiresIdentification(targetInfo);
      },
      on_dip: (ctx, state) => {
        const identity = String(state?.targetIdentity || "");
        if (!identity) return { applied: false, consumedTool: false };

        const wasNew = identify(identity);
        const targetName = String(ctx?.query?.name?.(state.targetId) || identity.replace(/_/g, " "));
        ctx.io.emit("item:identified", {
          actor: state.actor,
          identity,
          name: targetName,
          category: String(state?.targetInfo?.type || state?.targetInfo?.slot || "item"),
          newlyIdentified: wasNew,
        });
        return { applied: true, consumedTool: true, resultType: "identify" };
      },
    },
  },

  scroll_remove_curse: {
    id: "scroll_remove_curse",
    catalogKind: "magic",
    name: "Scroll of Remove Curse",
    type: "scroll",
    slot: "bag",
    material: "paper",
    rarity: 2,
    rarityName: "magic",
    weight: 0.1,
    value: 50,
    description: "Holy words purge corruption from an item.",
    hooks: {
      can_dip_target: (state) => {
        return state?.targetBeatitude === 'cursed';
      },
      on_dip: (ctx, state) => {
        const targetId = state?.targetId;
        if (!targetId) return { applied: false, consumedTool: false };
        const targetName = String(ctx?.query?.name?.(targetId) || "item");
        ctx.io.emit("curse:removed", {
          actor: state.actor,
          itemId: targetId,
          name: targetName,
          source: 'scroll',
        });
        return { applied: true, consumedTool: true, resultType: "remove_curse" };
      },
    },
  },

  // ── Cursed / Negative Rings ───────────────────────────────────────
  ring_hunger: {
    id: "ring_hunger",
    catalogKind: "equipment",
    name: "Ring of Hunger",
    type: "equip",
    slot: "ring",
    material: "iron",
    rarity: 2,
    rarityName: "magic",
    bonuses: { hungerRate: 2 },
    beatitude: "cursed",
    description: "A dull iron band that gnaws at your stomach. You feel ravenous.",
  },
  ring_fumbling: {
    id: "ring_fumbling",
    catalogKind: "equipment",
    name: "Ring of Fumbling",
    type: "equip",
    slot: "ring",
    material: "copper",
    rarity: 2,
    rarityName: "magic",
    bonuses: { attack: -3 },
    beatitude: "cursed",
    description: "A tarnished copper ring. Your hands feel clumsy.",
  },
  ring_weakness: {
    id: "ring_weakness",
    catalogKind: "equipment",
    name: "Ring of Weakness",
    type: "equip",
    slot: "ring",
    material: "lead",
    rarity: 2,
    rarityName: "magic",
    bonuses: { maxHp: -5 },
    beatitude: "cursed",
    description: "A heavy leaden ring. It saps your vitality.",
  },
  ring_blindness: {
    id: "ring_blindness",
    catalogKind: "equipment",
    name: "Ring of Blindness",
    type: "equip",
    slot: "ring",
    material: "obsidian",
    rarity: 2,
    rarityName: "magic",
    bonuses: { visionRange: -4 },
    beatitude: "cursed",
    description: "A ring of polished obsidian. Shadows creep at the edge of your vision.",
  },
  ring_teleportation: {
    id: "ring_teleportation",
    catalogKind: "equipment",
    name: "Ring of Teleportation",
    type: "equip",
    slot: "ring",
    material: "silver",
    rarity: 3,
    rarityName: "rare",
    bonuses: { luck: -5, visionRange: -2 },
    beatitude: "cursed",
    description: "A shimmering silver ring. Reality warps and shifts around you.",
  },

  // ── Bad Scrolls ───────────────────────────────────────────────────
  scroll_amnesia: {
    id: "scroll_amnesia",
    catalogKind: "magic",
    name: "Scroll of Amnesia",
    type: "scroll",
    slot: "bag",
    material: "paper",
    rarity: 1,
    rarityName: "common",
    weight: 0.1,
    value: 5,
    description: "The words burn away everything you know. Total oblivion.",
    hooks: {
      on_use: (ctx, state) => {
        const actor = Number(state?.actor || ctx.actor || 0) | 0;
        const brain = ctx.query.brain(actor);
        const forgottenSpells = [];
        if (brain) {
          if (Array.isArray(brain.learnedSpellIds)) {
            forgottenSpells.push(...brain.learnedSpellIds);
            brain.learnedSpellIds.length = 0;
          }
          if (Array.isArray(brain.itemKnowledgeIdentities)) {
            brain.itemKnowledgeIdentities.length = 0;
          }
          if (brain.seenTiles) {
            brain.seenTiles.fill(0);
          }
        }
        ctx.io.emit("scroll:amnesia", { actor, forgottenSpells, total: true });
        return { consumed: true };
      },
    },
  },
  scroll_fire: {
    id: "scroll_fire",
    catalogKind: "magic",
    name: "Scroll of Fire",
    type: "scroll",
    slot: "bag",
    material: "paper",
    rarity: 1,
    rarityName: "common",
    weight: 0.1,
    value: 5,
    description: "The scroll erupts in flames as you read it!",
    hooks: {
      on_use: (ctx, state) => {
        const actor = Number(state?.actor || ctx.actor || 0) | 0;
        const damage = ctx.helpers.roll("2d6");
        ctx.helpers.damage(actor, damage, "scroll_fire");
        ctx.io.emit("scroll:fire", { actor, damage });
        return { consumed: true };
      },
    },
  },
  scroll_aggravation: {
    id: "scroll_aggravation",
    catalogKind: "magic",
    name: "Scroll of Aggravation",
    type: "scroll",
    slot: "bag",
    material: "paper",
    rarity: 1,
    rarityName: "common",
    weight: 0.1,
    value: 5,
    description: "A terrible shriek fills the dungeon!",
    hooks: {
      on_use: (ctx, state) => {
        const actor = Number(state?.actor || ctx.actor || 0) | 0;
        ctx.io.emit("scroll:aggravation", { actor });
        return { consumed: true };
      },
    },
  },

  // ── Genocide ────────────────────────────────────────────────────
  scroll_genocide: {
    id: "scroll_genocide",
    catalogKind: "magic",
    name: "Scroll of Genocide",
    type: "scroll",
    slot: "bag",
    material: "paper",
    rarity: 4,
    rarityName: "epic",
    weight: 0.1,
    value: 200,
    description: "The parchment hums with finality. Name a creature, and it shall cease to exist.",
    hooks: {
      on_use: (ctx, state) => {
        const actor = Number(state?.actor || ctx.actor || 0) | 0;
        ctx.io.emit("scroll:genocide", { actor });
        return { consumed: true };
      },
    },
  },

  // ── Teleportation & Polymorph ────────────────────────────────────
  scroll_teleportation: {
    id: "scroll_teleportation",
    catalogKind: "magic",
    name: "Scroll of Teleportation",
    type: "scroll",
    slot: "bag",
    material: "paper",
    rarity: 1,
    rarityName: "common",
    weight: 0.1,
    value: 15,
    description: "Reality lurches. You blink and find yourself somewhere else entirely.",
    hooks: {
      on_use: (ctx, state) => {
        const actor = Number(state?.actor || ctx.actor || 0) | 0;
        ctx.io.emit("scroll:teleportation", { actor });
        return { consumed: true };
      },
    },
  },
  scroll_polymorph: {
    id: "scroll_polymorph",
    catalogKind: "magic",
    name: "Scroll of Polymorph",
    type: "scroll",
    slot: "bag",
    material: "paper",
    rarity: 4,
    rarityName: "epic",
    weight: 0.1,
    value: 80,
    description: "The words twist reality itself. Name a creature and watch the nearest foe reshape.",
    hooks: {
      on_use: (ctx, state) => {
        const actor = Number(state?.actor || ctx.actor || 0) | 0;
        ctx.io.emit("scroll:polymorph", { actor });
        return { consumed: true };
      },
    },
  },

  // ── Bad Potions ───────────────────────────────────────────────────
  potion_sickness: {
    id: "potion_sickness",
    catalogKind: "magic",
    name: "Potion of Sickness",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 1,
    rarityName: "common",
    value: 5,
    description: "A foul brew that turns your stomach.",
    potion: {
      route: "oral",
      doses: 1,
      channels: [{ type: "damage", amount: 4 }],
      effects: [
        { key: "poison", potency: 2, onset: 0, peak: 0, duration: 15, stack: "add", meta: { source: "potion_sickness" } },
      ],
      feel: "Your stomach lurches violently.",
    },
    hooks: {
      on_drink: (ctx, state) => {
        const actor = Number(state?.actor || ctx.actor || 0) | 0;
        ctx.io.emit("potion:sickness", { actor });
        return { consumed: true };
      },
    },
  },

  // ── Bad Potions ───────────────────────────────────────────────────

  potion_paralysis: {
    id: "potion_paralysis",
    catalogKind: "magic",
    name: "Potion of Paralysis",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 1,
    rarityName: "common",
    value: 5,
    description: "A thick, syrupy liquid that locks every muscle in place.",
    potion: {
      route: "oral",
      doses: 1,
      channels: [],
      effects: [
        { key: "stun", potency: 1, onset: 0, peak: 0, duration: 10, stack: "refresh", maxStacks: 1, meta: { source: "potion_paralysis" } },
      ],
      feel: "Your body goes rigid. You can't move!",
    },
    hooks: {
      on_drink: (ctx, state) => {
        const actor = Number(state?.actor || ctx.actor || 0) | 0;
        ctx.io.emit("potion:paralysis", { actor });
        return { consumed: true };
      },
    },
  },
  potion_hallucination: {
    id: "potion_hallucination",
    catalogKind: "magic",
    name: "Potion of Hallucination",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 1,
    rarityName: "common",
    value: 5,
    description: "A swirling iridescent brew. The walls are breathing.",
    potion: {
      route: "oral",
      doses: 1,
      channels: [],
      effects: [
        { key: "hallucinating", potency: 1, onset: 0, peak: 0, duration: 35, stack: "refresh", maxStacks: 1, meta: { source: "potion_hallucination" } },
      ],
      feel: "The colours... they're singing.",
    },
    hooks: {
      on_drink: (ctx, state) => {
        const actor = Number(state?.actor || ctx.actor || 0) | 0;
        ctx.io.emit("potion:hallucination", { actor });
        return { consumed: true };
      },
    },
  },
  potion_blindness: {
    id: "potion_blindness",
    catalogKind: "magic",
    name: "Potion of Blindness",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 1,
    rarityName: "common",
    value: 5,
    description: "A pitch-black draught that steals the light from your eyes.",
    potion: {
      route: "oral",
      doses: 1,
      channels: [],
      effects: [],
      feel: "Everything goes dark.",
    },
    hooks: {
      on_drink: (ctx, state) => {
        const actor = Number(state?.actor || ctx.actor || 0) | 0;
        const startValue = Number(ctx.query.effectiveVisionRange(actor) || 0);
        ctx.mutate.pushEffect(actor, {
          key: "stat_envelope",
          stat: "visionRange",
          turnsLeft: 20,
          potency: 1,
          startValue,
          toValue: 0,
          endValue: startValue,
          rampIn: 0,
          hold: 20,
          rampOut: 0,
          sourceId: Number(state?.itemId || ctx.primary || 0) | 0,
          startedAtTurn: Number(ctx.params?.stepHint || 0) | 0,
          stack: "refresh",
        });
        ctx.io.emit("potion:blindness", { actor });
        return { consumed: true };
      },
    },
  },
  potion_weakness: {
    id: "potion_weakness",
    catalogKind: "magic",
    name: "Potion of Weakness",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 2,
    rarityName: "magic",
    value: 5,
    description: "A thin grey liquid that drains your life force.",
    potion: {
      route: "oral",
      doses: 1,
      channels: [],
      effects: [
        { key: "weakened", potency: 1, onset: 0, peak: 0, duration: 40, stack: "refresh", maxStacks: 1, meta: { source: "potion_weakness" } },
      ],
      feel: "Your strength fades. Everything feels heavier.",
    },
    hooks: {
      on_drink: (ctx, state) => {
        const actor = Number(state?.actor || ctx.actor || 0) | 0;
        const vit = ctx.query.get(actor, Vitality);
        if (vit) {
          vit.maxHp = Math.max(1, (vit.maxHp | 0) - 8);
          if (vit.hp > vit.maxHp) vit.hp = vit.maxHp;
        }
        const stam = ctx.query.get(actor, Stamina);
        if (stam) {
          stam.max = Math.max(1, (stam.max | 0) - 8);
          if (stam.current > stam.max) stam.current = stam.max;
        }
        ctx.io.emit("potion:weakness", { actor, hpLost: 8, staminaLost: 8 });
        return { consumed: true };
      },
    },
  },
  potion_confusion: {
    id: "potion_confusion",
    catalogKind: "magic",
    name: "Potion of Confusion",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 1,
    rarityName: "common",
    value: 5,
    description: "A fizzing, disorienting concoction.",
    potion: {
      route: "oral",
      doses: 1,
      channels: [],
      effects: [
        { key: "confused", potency: 1, onset: 0, peak: 0, duration: 15, stack: "refresh", maxStacks: 1, meta: { source: "potion_confusion" } },
      ],
      feel: "Which way is up? You can't tell anymore.",
    },
    hooks: {
      on_drink: (ctx, state) => {
        const actor = Number(state?.actor || ctx.actor || 0) | 0;
        ctx.io.emit("potion:confusion", { actor });
        return { consumed: true };
      },
    },
  },

  // ── Bad Scrolls (new) ──────────────────────────────────────────────

  scroll_cursing: {
    id: "scroll_cursing",
    catalogKind: "magic",
    name: "Scroll of Cursing",
    type: "scroll",
    slot: "bag",
    material: "paper",
    rarity: 2,
    rarityName: "magic",
    weight: 0.1,
    value: 5,
    description: "Dark words slither off the page and weld your gear to your body.",
    hooks: {
      on_use: (ctx, state) => {
        const actor = Number(state?.actor || ctx.actor || 0) | 0;
        const equip = ctx.query.get(actor, Equipment);
        let cursed = 0;
        if (equip) {
          for (const slot of GEAR_SLOTS) {
            const itemId = equip[slot];
            if (!(itemId > 0)) continue;
            const beat = ctx.query.get(itemId, Beatitude);
            if (beat && beat.state === 'cursed') continue;
            cursed++;
            ctx.io.emit("curse:equipment", { actor, itemId, source: "scroll_cursing" });
            if (cursed >= 3) break;
          }
        }
        ctx.io.emit("scroll:cursing", { actor, count: cursed });
        return { consumed: true };
      },
    },
  },
  scroll_summoning: {
    id: "scroll_summoning",
    catalogKind: "magic",
    name: "Scroll of Summoning",
    type: "scroll",
    slot: "bag",
    material: "paper",
    rarity: 2,
    rarityName: "magic",
    weight: 0.1,
    value: 5,
    description: "The words screech and claw shapes pour from the parchment.",
    hooks: {
      on_use: (ctx, state) => {
        const actor = Number(state?.actor || ctx.actor || 0) | 0;
        ctx.io.emit("scroll:summoning", { actor });
        return { consumed: true };
      },
    },
  },
  scroll_decay: {
    id: "scroll_decay",
    catalogKind: "magic",
    name: "Scroll of Decay",
    type: "scroll",
    slot: "bag",
    material: "paper",
    rarity: 1,
    rarityName: "common",
    weight: 0.1,
    value: 5,
    description: "The scroll crumbles and a wave of rot spreads through your pack.",
    hooks: {
      on_use: (ctx, state) => {
        const actor = Number(state?.actor || ctx.actor || 0) | 0;
        ctx.io.emit("scroll:decay", { actor });
        return { consumed: true };
      },
    },
  },

  // ── Cursed Amulets ─────────────────────────────────────────────────

  amulet_strangulation: {
    id: "amulet_strangulation",
    catalogKind: "equipment",
    name: "Amulet of Strangulation",
    type: "equip",
    slot: "neck",
    material: "iron",
    rarity: 2,
    rarityName: "magic",
    bonuses: { maxHp: -3 },
    beatitude: "cursed",
    description: "The chain tightens around your throat. You can feel it constricting.",
  },
  amulet_aggravation: {
    id: "amulet_aggravation",
    catalogKind: "equipment",
    name: "Amulet of Aggravation",
    type: "equip",
    slot: "neck",
    material: "bone",
    rarity: 2,
    rarityName: "magic",
    bonuses: { defense: -1 },
    beatitude: "cursed",
    description: "A crude fetish of yellowed bone. Everything in the dungeon knows exactly where you are.",
  },

  // ── Cursed Rings (new) ─────────────────────────────────────────────

  ring_fragility: {
    id: "ring_fragility",
    catalogKind: "equipment",
    name: "Ring of Fragility",
    type: "equip",
    slot: "ring",
    material: "glass",
    rarity: 2,
    rarityName: "magic",
    bonuses: { defense: -3, bluntResist: -0.15, slashResist: -0.15 },
    beatitude: "cursed",
    description: "A brittle glass ring. Your skin feels paper-thin.",
  },
  ring_mana_drain: {
    id: "ring_mana_drain",
    catalogKind: "equipment",
    name: "Ring of Mana Drain",
    type: "equip",
    slot: "ring",
    material: "lead",
    rarity: 2,
    rarityName: "magic",
    bonuses: { manaRegen: -1.0, maxMana: -10 },
    beatitude: "cursed",
    description: "A dull leaden band that devours arcane energy. Your spells wither on your tongue.",
  },

  food_mushrooms: {
    id: "food_mushrooms",
    catalogKind: "food",
    name: "Dungeon Mushrooms",
    type: "food",
    slot: "bag",
    material: "organic",
    rarity: 1,
    rarityName: "common",
    weight: 0.15,
    value: 3,
    description: "Pale mushrooms from the dungeon depths. Probably safe.",
    hooks: {
      on_use: (ctx, state) => {
        const result = EAT_ON_USE(ctx, state);
        const actor = Number(state?.actor || ctx.actor || 0) | 0;
        ctx.mutate.pushEffect(actor, {
          key: "hallucinating",
          turnsLeft: 30,
          potency: 1,
          stacks: 1,
        });
        ctx.mutate.pushEffect(actor, {
          key: "berserk",
          turnsLeft: 30,
          potency: 1,
          stacks: 1,
        });
        ctx.io.emit("mushroom:hallucinate", { actor });
        return result;
      },
    },
  },

};

// ── Gem socket hook registry (separate from ITEM_CATALOG to avoid duplication) ──
// Gems are defined in gems.js; hooks live here and are resolved via getGemItemHooks().
const GEM_ITEM_HOOKS = Object.freeze({
  gem_ruby:     { canDipTarget: canGemSocketDipTarget, onDip: createGemSocketDipHook("gem_ruby") },
  gem_sapphire: { canDipTarget: canGemSocketDipTarget, onDip: createGemSocketDipHook("gem_sapphire") },
  gem_emerald:  { canDipTarget: canGemSocketDipTarget, onDip: createGemSocketDipHook("gem_emerald") },
  gem_diamond:  { canDipTarget: canGemSocketDipTarget, onDip: createGemSocketDipHook("gem_diamond") },
  gem_topaz:    { canDipTarget: canGemSocketDipTarget, onDip: createGemSocketDipHook("gem_topaz") },
  gem_amethyst: { canDipTarget: canGemSocketDipTarget, onDip: createGemSocketDipHook("gem_amethyst") },
  gem_opal:     { canDipTarget: canGemSocketDipTarget, onDip: createGemSocketDipHook("gem_opal") },
  gem_obsidian: { canDipTarget: canGemSocketDipTarget, onDip: createGemSocketDipHook("gem_obsidian") },
  gem_garnet:   { canDipTarget: canGemSocketDipTarget, onDip: createGemSocketDipHook("gem_garnet") },
});

/**
 * Returns gem socket hooks for a given gem identity, or null if not found.
 * @param {string} identity
 * @returns {{ canDipTarget: Function, onDip: Function } | null}
 */
export function getGemItemHooks(identity) {
  return GEM_ITEM_HOOKS[String(identity || "").toLowerCase()] || null;
}

const ITEM_CATALOG_ID_ALIASES = Object.freeze({
  // Save compatibility: pre-catalog touchstone identity
  touchstone: "stone_touchstone",
});

/**
 * @param {string} id
 * @returns {string}
 */
function resolveCatalogItemId(id) {
  const key = String(id || "").trim().toLowerCase();
  if (!key) return "";
  return ITEM_CATALOG_ID_ALIASES[key] || key;
}

export function listCatalogItems() { return Object.values(ITEM_CATALOG); }
export function getCatalogItem(id) {
  const key = resolveCatalogItemId(id);
  if (!key) return null;
  return ITEM_CATALOG[key] || null;
}
export function isCatalogEquipment(def) { return !!def && String(def.catalogKind) === "equipment"; }
export function isCatalogMagic(def) { return !!def && String(def.catalogKind) === "magic"; }
