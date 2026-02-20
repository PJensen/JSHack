// Unified item catalog: equipment + magic/usable items.
// This is the single source of truth for item-like definitions.
import { getSpell } from "./spells.js";
import { getGem } from "./gems.js";
import { identify } from "./identification.js";
import { createEatOnUseHook, createMappingOnUseHook } from "../content/items/useNativeHooks.js";

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
    bonuses: { attack: 3 },
    damageDice: "1d8",
    staminaCost: 12,
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
        const turns = ctx.helpers.int(10, 14);
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
};

export function listCatalogItems() { return Object.values(ITEM_CATALOG); }
export function getCatalogItem(id) { return ITEM_CATALOG[id] || null; }
export function isCatalogEquipment(def) { return !!def && String(def.catalogKind) === "equipment"; }
export function isCatalogMagic(def) { return !!def && String(def.catalogKind) === "magic"; }
