// Unified item catalog: equipment + magic/usable items.
// This is the single source of truth for item-like definitions.
import { getSpell } from "./spells.js";
import { getGem } from "./gems.js";
import { identify } from "./identification.js";
import { createEatOnUseHook, createMappingOnUseHook } from "../content/items/useNativeHooks.js";
import { Vitality } from "../components/Vitality.js";
import { Stamina } from "../components/Stamina.js";
import { Equipment } from "../components/Equipment.js";

/**
 * @param {string} identity
 * @param {string} prefix
 */
function spellIdFromIdentity(identity, prefix) {
  const id = String(identity || "").toLowerCase();
  const p = String(prefix || "").toLowerCase();
  if (!p || !id.startsWith(p)) return "";
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
  "shield",
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
    bonuses: { attack: 1, manaRegen: 0.05 },
    damageDice: "1d6",
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
    bonuses: { attack: 3 },
    damageDice: "1d8",
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
    bonuses: { attack: 2 },
    damageDice: "1d6",
    staminaCost: 8,
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
    bonuses: { attack: 1 },
    damageDice: "1d4",
    staminaCost: 5,
    description: "A slim steel blade, light enough to strike in a blink.",
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
    bonuses: { attack: 3, chop: 1 },
    damageDice: "1d8",
    staminaCost: 12,
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
    bonuses: { attack: 2 },
    damageDice: "1d8",
    staminaCost: 11,
    description: "A heavy iron head on a wooden haft. Favored by the faithful.",
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
    bonuses: { manaRegen: 0.5 },
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
    slot: "shield",
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
    slot: "shield",
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
    slot: "shield",
    material: "iron",
    rarity: 2,
    rarityName: "magic",
    bonuses: { defense: 2 },
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
    bonuses: { dig: 1 },
    damageDice: "1d4",
    staminaCost: 25,
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
    staminaCost: 10,
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
    slot: "shield",
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
    staminaCost: 8,
    affixes: ["capacitive1"],
  },
  grounded_buckler: {
    id: "grounded_buckler",
    catalogKind: "equipment",
    name: "Grounded Buckler",
    type: "equip",
    slot: "shield",
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
    staminaCost: 7,
    affixes: ["fierce"],
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
  shield_steel: {
    id: "shield_steel",
    catalogKind: "equipment",
    name: "Steel Shield",
    type: "equip",
    slot: "shield",
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
    slot: "shield",
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
    staminaCost: 10,
    description: "The head glows cherry-red, leaving scorch marks on everything it strikes.",
    affixes: ["firestorm1"],
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
    staminaCost: 12,
    description: "The wind screams through holes bored in the hammerhead.",
    affixes: ["hemorrhage1", "berserk1"],
  },
  wardkeeper_shield: {
    id: "wardkeeper_shield",
    catalogKind: "equipment",
    name: "Wardkeeper Shield",
    type: "equip",
    slot: "shield",
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
    slot: "shield",
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
          meta: { source: "potion_stoneskin", kind: "armor_buff" },
        });
        ctx.io.emit("status", { id: targetId, kind: "buff", text: "STONESKIN", source: actorId });
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
    },
    hooks: {
      on_drink: (ctx, state) => {
        const targetId = ctx.rules.resolveTarget(Number(state?.actor || ctx.actor || 0) | 0);
        const stam = ctx.query.get(targetId, Stamina);
        if (!stam) return { restored: 0 };
        const eq = ctx.query.get(targetId, Equipment);
        const maxBonus = Number(eq?.maxStaminaDerived ?? 0);
        const cap = stam.maxStamina + maxBonus;
        const before = stam.stamina;
        stam.stamina = cap;
        return { restored: stam.stamina - before };
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
          meta: { source: "potion_resist_fire", kind: "resist_buff" },
        });
        ctx.io.emit("status", { id: targetId, kind: "buff", text: "FIRE RESIST", source: Number(state?.actor || ctx.actor || 0) | 0 });
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
          meta: { source: "potion_resist_poison", kind: "resist_buff" },
        });
        ctx.io.emit("status", { id: targetId, kind: "buff", text: "POISON RESIST", source: Number(state?.actor || ctx.actor || 0) | 0 });
        return { resist: "poison", duration: 40 };
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
          meta: { source: "potion_resist_electric", kind: "resist_buff" },
        });
        ctx.io.emit("status", { id: targetId, kind: "buff", text: "LIGHTNING RESIST", source: Number(state?.actor || ctx.actor || 0) | 0 });
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
          meta: { source: "potion_resist_acid", kind: "resist_buff" },
        });
        ctx.io.emit("status", { id: targetId, kind: "buff", text: "ACID RESIST", source: Number(state?.actor || ctx.actor || 0) | 0 });
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
    rarity: 1,
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
    rarity: 1,
    rarityName: "rare",
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
    rarity: 1,
    rarityName: "rare",
    description: "Grants the ability to cast a blast wave spell.",
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
    rarity: 1,
    rarityName: "rare",
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
    rarity: 1,
    rarityName: "rare",
    description: "Grants the ability to cast Frost.",
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
    rarity: 1,
    rarityName: "rare",
    description: "Grants the ability to cast a healing spell.",
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
    rarity: 1,
    rarityName: "rare",
    description: "Casts Blast Wave without learning it.",
    hooks: {
      on_use: createCastSpellFromIdentityHook({
        identityPrefix: "scroll_",
        targetMode: "self",
        consumeOnSuccess: true,
      }),
    },
  },
  scroll_homecoming: {
    id: "scroll_homecoming",
    catalogKind: "magic",
    name: "Scroll of Homecoming",
    type: "scroll",
    slot: "bag",
    material: "paper",
    rarity: 1,
    rarityName: "rare",
    description: "Returns you to the surface (dungeon level 0).",
    hooks: {
      on_use: createCastSpellFromIdentityHook({
        identityPrefix: "scroll_",
        targetMode: "self",
        consumeOnSuccess: true,
      }),
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
    rarityName: "rare",
    description: "Casts a healing spell on yourself or an ally.",
    hooks: {
      on_use: createCastSpellFromIdentityHook({
        identityPrefix: "scroll_",
        targetMode: "target",
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
    rarity: 1,
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
    rarity: 1,
    rarityName: "rare",
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
    rarity: 1,
    rarityName: "rare",
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
    rarity: 1,
    rarityName: "rare",
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
