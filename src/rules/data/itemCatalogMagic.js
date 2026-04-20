// Magic, consumable, food, material, seed, and cursed item entries.
import {
  canTouchstoneDipTarget,
  createTouchstoneDipHook,
  canPoisonDipTarget,
  createPoisonCoatDipHook,
  createPoisonCloudThrowHook,
  canParalysisDipTarget,
  createParalysisCoatDipHook,
  canStonecoatDipTarget,
  createWaterPotionHooks,
  createCastSpellFromIdentityHook,
  createWandShatterThrowHook,
  createPotionSplashThrowHook,
  createLearnSpellFromIdentityHook,
  createOpenFlavorBookHook,
  EAT_ON_USE,
  MAPPING_ON_USE,
  resolveApplyTargetName,
} from "./itemCatalogHooks.js";
import { requiresIdentification } from "./itemAppearances.js";
import { isIdentified, identify } from "./identification.js";
import { Beatitude } from "../components/Beatitude.js";
import { Equipment, GEAR_SLOTS } from "../components/Equipment.js";
import { ItemCooldown } from "../components/ItemCooldown.js";
import { Vitality } from "../components/Vitality.js";
import { Stamina } from "../components/Stamina.js";
import { Mana } from "../components/Mana.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { createStatusEvent } from "../../shared/events/statusEvent.js";
import { getPassiveBonuses } from "../utils/passiveBonuses.js";
import { attachDerivedExpression, exprAddConst } from "../utils/statProcAuthoring.js";
import { resolveItemCooldownRemaining } from "../utils/itemCooldowns.js";

/**
 * Destroy any existing DerivedExpression entity owned by an active effect
 * with the given key. Prevents orphaned expr entities on refresh (re-drink).
 */
function cleanupPriorExprEntity(ctx, targetId, effectKey) {
  const ae = ctx.query.get(targetId, ActiveEffects);
  if (!ae || !Array.isArray(ae.effects)) return;
  for (const e of ae.effects) {
    if (e?.key !== effectKey) continue;
    const exprId = e?.meta?.exprEntityId;
    if (typeof exprId === 'number' && exprId > 0) {
      try { ctx.world.destroy(exprId); } catch {}
    }
  }
}

export const MAGIC_ITEMS = {
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
  relic_ember_censer: {
    id: "relic_ember_censer",
    catalogKind: "magic",
    name: "Ember Censer",
    type: "tool",
    slot: "bag",
    material: "metal",
    rarity: 5,
    rarityName: "artifact",
    value: 420,
    weight: 6,
    description: "A soot-black censer that never stops breathing warm ash. Town elders want it back, intact.",
  },
  relic_glass_heart: {
    id: "relic_glass_heart",
    catalogKind: "magic",
    name: "Glass Heart",
    type: "tool",
    slot: "bag",
    material: "glass",
    rarity: 5,
    rarityName: "artifact",
    value: 440,
    weight: 2,
    description: "A clear heart-shot crystal that pulses with trapped heat. It feels important in the worst way.",
  },
  relic_pale_idol: {
    id: "relic_pale_idol",
    catalogKind: "magic",
    name: "Pale Idol",
    type: "tool",
    slot: "bag",
    material: "bone",
    rarity: 5,
    rarityName: "artifact",
    value: 400,
    weight: 4,
    description: "A chalk-white idol worn smooth by terrified hands. It should not have been left below.",
  },
  relic_stone_tongue: {
    id: "relic_stone_tongue",
    catalogKind: "magic",
    name: "Stone Tongue",
    type: "tool",
    slot: "bag",
    material: "mineral",
    rarity: 5,
    rarityName: "artifact",
    value: 430,
    weight: 5,
    description: "A carved shard shaped like a speaking tongue. It tastes of old rain and sealed crypts.",
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
    weight: 0.5, // glass potion
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
    weight: 0.5, // glass potion
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
    weight: 0.5, // glass potion
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
    weight: 0.5, // glass potion
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
    name: "Health Potion",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 2,
    rarityName: "magic",
    value: 40,
    description: "A crimson draught that mends wounds in a single heartbeat.",
    weight: 0.5, // glass potion
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
      on_throw: createPotionSplashThrowHook({
        healPct: 0.15,
        sourceKind: "potion_vigor",
      }),
    },
  },
  potion_adrenaline: {
    id: "potion_adrenaline",
    catalogKind: "magic",
    name: "Berserk Potion",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 2,
    rarityName: "magic",
    value: 45,
    description: "A jolt of pure energy that instantly restores all stamina.",
    weight: 0.5, // glass potion
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
      on_throw: createPotionSplashThrowHook({
        effectKey: "berserk",
        duration: 8,
        potency: 1,
        sourceKind: "potion_adrenaline",
      }),
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
    identified: true,
    value: 50,
    description: "A shimmering azure elixir that accelerates mana recovery for a short time.",
    weight: 0.5, // glass potion
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
        const actorId = Number(state?.actor || ctx.actor || 0) | 0;
        const targetId = ctx.rules.resolveTarget(actorId);
        cleanupPriorExprEntity(ctx, targetId, "mana_potion_regen");
        const exprId = attachDerivedExpression(ctx.world, targetId,
          exprAddConst("manaRegen", 3, { stage: "derived" }));
        ctx.helpers.addEffect(targetId, {
          key: "mana_potion_regen", turnsLeft: 20, potency: 1,
          stack: "refresh", maxStacks: 1,
          meta: { source: "potion_mana", exprEntityId: exprId },
        });
        ctx.io.emit("status", createStatusEvent({
          id: targetId, kind: "buff", effect: "mana_regen",
          source: actorId, masked: !state.identified,
        }));
        return { turns: 20 };
      },
      on_throw: createPotionSplashThrowHook({
        effectKey: "silenced",
        duration: 6,
        potency: 1,
        sourceKind: "potion_mana",
      }),
    },
  },
  potion_endurance: {
    id: "potion_endurance",
    catalogKind: "magic",
    name: "Stamina Potion",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 2,
    rarityName: "magic",
    value: 35,
    description: "Liquid lightning that floods the muscles with stamina.",
    weight: 0.5, // glass potion
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
    hooks: {
      on_throw: createPotionSplashThrowHook({
        effectKey: "stamina_restore",
        duration: 50,
        potency: 1,
        sourceKind: "potion_endurance",
      }),
    },
  },
  potion_second_wind: {
    id: "potion_second_wind",
    catalogKind: "magic",
    name: "Stamina Elixir",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 2,
    rarityName: "magic",
    value: 50,
    description: "A cool teal elixir that quickens stamina recovery for several turns.",
    weight: 0.5, // glass potion
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
    hooks: {
      on_throw: createPotionSplashThrowHook({
        effectKey: "stamina_regen_boost",
        duration: 12,
        potency: 3,
        sourceKind: "potion_second_wind",
      }),
    },
  },
  potion_resist_fire: {
    id: "potion_resist_fire",
    catalogKind: "magic",
    name: "Fire Ward Potion",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 2,
    rarityName: "magic",
    value: 55,
    description: "An icy draught that coats the drinker in a shimmering heat ward.",
    weight: 0.5, // glass potion
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
      can_dip_target: canStonecoatDipTarget,
      on_dip: (ctx, state) => {
        const targetId = Number(state?.targetId || ctx.target || 0) | 0;
        if (!(targetId > 0)) return { applied: false, consumedTool: false, resultType: "nothing" };
        const info = ctx.query.itemInfo(targetId);
        const bonuses = (info?.bonuses && typeof info.bonuses === "object") ? { ...info.bonuses } : {};
        bonuses.fireResist = Math.min(0.5, Number(bonuses.fireResist || 0) + 0.1);
        const targetName = resolveApplyTargetName(ctx, state, "item");
        ctx.helpers.patchItemInfo(targetId, { bonuses, description: `${String(info?.description || "Item")} Infused with fire resistance (+10%).` });
        ctx.io.emit("item:applied", { actor: state.actor, toolId: state.toolId, targetId, result: { type: "resist_enchant", resistType: "fire", bonus: 0.1, message: `You infuse ${targetName} with fire resistance (+10%, max 50%).` } });
        return { applied: true, consumedTool: true, resultType: "resist_fire_enchant" };
      },
      on_throw: createPotionSplashThrowHook({
        effectKey: "resist_fire",
        duration: 20,
        potency: 0.3,
        sourceKind: "potion_resist_fire",
      }),
    },
  },
  potion_resist_poison: {
    id: "potion_resist_poison",
    catalogKind: "magic",
    name: "Poison Ward Potion",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 2,
    rarityName: "magic",
    value: 55,
    description: "A bitter emerald tonic that fortifies the body against toxins.",
    weight: 0.5, // glass potion
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
      can_dip_target: canStonecoatDipTarget,
      on_dip: (ctx, state) => {
        const targetId = Number(state?.targetId || ctx.target || 0) | 0;
        if (!(targetId > 0)) return { applied: false, consumedTool: false, resultType: "nothing" };
        const info = ctx.query.itemInfo(targetId);
        const bonuses = (info?.bonuses && typeof info.bonuses === "object") ? { ...info.bonuses } : {};
        bonuses.poisonResist = Math.min(0.5, Number(bonuses.poisonResist || 0) + 0.1);
        const targetName = resolveApplyTargetName(ctx, state, "item");
        ctx.helpers.patchItemInfo(targetId, { bonuses, description: `${String(info?.description || "Item")} Infused with poison resistance (+10%).` });
        ctx.io.emit("item:applied", { actor: state.actor, toolId: state.toolId, targetId, result: { type: "resist_enchant", resistType: "poison", bonus: 0.1, message: `You infuse ${targetName} with poison resistance (+10%, max 50%).` } });
        return { applied: true, consumedTool: true, resultType: "resist_poison_enchant" };
      },
      on_throw: createPotionSplashThrowHook({
        effectKey: "resist_poison",
        duration: 20,
        potency: 0.3,
        sourceKind: "potion_resist_poison",
      }),
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
    weight: 0.5, // glass potion
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
      on_throw: createPotionSplashThrowHook({
        effectKey: "resist_poison",
        duration: 15,
        potency: 0.2,
        sourceKind: "potion_anti_venom",
      }),
    },
  },
  potion_resist_electric: {
    id: "potion_resist_electric",
    catalogKind: "magic",
    name: "Lightning Ward Potion",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 2,
    rarityName: "magic",
    value: 55,
    description: "A crackling blue elixir that grounds the drinker against electrical surges.",
    weight: 0.5, // glass potion
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
      can_dip_target: canStonecoatDipTarget,
      on_dip: (ctx, state) => {
        const targetId = Number(state?.targetId || ctx.target || 0) | 0;
        if (!(targetId > 0)) return { applied: false, consumedTool: false, resultType: "nothing" };
        const info = ctx.query.itemInfo(targetId);
        const bonuses = (info?.bonuses && typeof info.bonuses === "object") ? { ...info.bonuses } : {};
        bonuses.electricResist = Math.min(0.5, Number(bonuses.electricResist || 0) + 0.1);
        const targetName = resolveApplyTargetName(ctx, state, "item");
        ctx.helpers.patchItemInfo(targetId, { bonuses, description: `${String(info?.description || "Item")} Infused with lightning resistance (+10%).` });
        ctx.io.emit("item:applied", { actor: state.actor, toolId: state.toolId, targetId, result: { type: "resist_enchant", resistType: "electric", bonus: 0.1, message: `You infuse ${targetName} with lightning resistance (+10%, max 50%).` } });
        return { applied: true, consumedTool: true, resultType: "resist_electric_enchant" };
      },
      on_throw: createPotionSplashThrowHook({
        effectKey: "resist_electric",
        duration: 20,
        potency: 0.3,
        sourceKind: "potion_resist_electric",
      }),
    },
  },
  potion_resist_acid: {
    id: "potion_resist_acid",
    catalogKind: "magic",
    name: "Acid Ward Potion",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 2,
    rarityName: "magic",
    value: 55,
    description: "A thick amber syrup that shields the skin from corrosive burns.",
    weight: 0.5, // glass potion
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
      can_dip_target: canStonecoatDipTarget,
      on_dip: (ctx, state) => {
        const targetId = Number(state?.targetId || ctx.target || 0) | 0;
        if (!(targetId > 0)) return { applied: false, consumedTool: false, resultType: "nothing" };
        const info = ctx.query.itemInfo(targetId);
        const bonuses = (info?.bonuses && typeof info.bonuses === "object") ? { ...info.bonuses } : {};
        bonuses.acidResist = Math.min(0.5, Number(bonuses.acidResist || 0) + 0.1);
        const targetName = resolveApplyTargetName(ctx, state, "item");
        ctx.helpers.patchItemInfo(targetId, { bonuses, description: `${String(info?.description || "Item")} Infused with acid resistance (+10%).` });
        ctx.io.emit("item:applied", { actor: state.actor, toolId: state.toolId, targetId, result: { type: "resist_enchant", resistType: "acid", bonus: 0.1, message: `You infuse ${targetName} with acid resistance (+10%, max 50%).` } });
        return { applied: true, consumedTool: true, resultType: "resist_acid_enchant" };
      },
      on_throw: createPotionSplashThrowHook({
        effectKey: "resist_acid",
        duration: 20,
        potency: 0.3,
        sourceKind: "potion_resist_acid",
      }),
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
    weight: 0.7, // spellbook
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
    weight: 0.7, // spellbook
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
    weight: 0.7, // spellbook
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
    weight: 0.7, // spellbook
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
    weight: 0.7, // spellbook
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
    weight: 0.7, // spellbook
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
    weight: 0.7, // spellbook
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
    weight: 0.7, // spellbook
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
    weight: 0.7, // spellbook
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
    weight: 0.7, // spellbook
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
    weight: 0.7, // spellbook
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
    weight: 0.7, // spellbook
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
    weight: 0.7, // spellbook
    hooks: {
      on_use: createLearnSpellFromIdentityHook({
        identityPrefix: "book_",
        consumeOnSuccess: true,
      }),
    },
  },
  book_flash_heal: {
    id: "book_flash_heal",
    catalogKind: "magic",
    name: "Spellbook of Flash Heal",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 3,
    rarityName: "rare",
    description: "Grants the ability to cast Flash Heal.",
    weight: 0.7, // spellbook
    hooks: {
      on_use: createLearnSpellFromIdentityHook({
        identityPrefix: "book_",
        consumeOnSuccess: true,
      }),
    },
  },
  book_smite: {
    id: "book_smite",
    catalogKind: "magic",
    name: "Spellbook of Smite",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 2,
    rarityName: "magic",
    description: "Grants the ability to call down holy judgment on enemies.",
    weight: 0.7, // spellbook
    hooks: {
      on_use: createLearnSpellFromIdentityHook({
        identityPrefix: "book_",
        consumeOnSuccess: true,
      }),
    },
  },
  book_summon_skeleton: {
    id: "book_summon_skeleton",
    catalogKind: "magic",
    name: "Spellbook of Summon Skeleton",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 4,
    rarityName: "epic",
    description: "Grants the ability to rip a skeleton from the earth to fight at your side.",
    weight: 0.7, // spellbook
    hooks: {
      on_use: createLearnSpellFromIdentityHook({
        identityPrefix: "book_",
        consumeOnSuccess: true,
      }),
    },
  },
  book_shadow_bolt: {
    id: "book_shadow_bolt",
    catalogKind: "magic",
    name: "Spellbook of Shadow Bolt",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 4,
    rarityName: "epic",
    description: "Grants the ability to hurl a devastating bolt of pure shadow.",
    weight: 0.7, // spellbook
    hooks: {
      on_use: createLearnSpellFromIdentityHook({
        identityPrefix: "book_",
        consumeOnSuccess: true,
      }),
    },
  },
  book_agony: {
    id: "book_agony",
    catalogKind: "magic",
    name: "Spellbook of Agony",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 3,
    rarityName: "rare",
    description: "Grants the ability to weave shadow into a curse that gnaws at life force.",
    weight: 0.7, // spellbook
    hooks: {
      on_use: createLearnSpellFromIdentityHook({
        identityPrefix: "book_",
        consumeOnSuccess: true,
      }),
    },
  },
  book_rampage: {
    id: "book_rampage",
    catalogKind: "magic",
    name: "Spellbook of Rampage",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 3,
    rarityName: "rare",
    description: "Grants the ability to spend mana for a long, savage battle fury.",
    weight: 0.7, // spellbook
    hooks: {
      on_use: createLearnSpellFromIdentityHook({
        identityPrefix: "book_",
        consumeOnSuccess: true,
      }),
    },
  },
  book_phase_strike: {
    id: "book_phase_strike",
    catalogKind: "magic",
    name: "Spellbook of Phase Strike",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 3,
    rarityName: "rare",
    description: "Grants the ability to slip between moments and cut everything on your line.",
    weight: 0.7, // spellbook
    hooks: {
      on_use: createLearnSpellFromIdentityHook({
        identityPrefix: "book_",
        consumeOnSuccess: true,
      }),
    },
  },
  book_scorch: {
    id: "book_scorch",
    catalogKind: "magic",
    name: "Spellbook of Scorch",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 2,
    rarityName: "magic",
    description: "Grants the ability to sear a target with fire and leave them vulnerable to further burning.",
    weight: 0.7, // spellbook
    hooks: {
      on_use: createLearnSpellFromIdentityHook({
        identityPrefix: "book_",
        consumeOnSuccess: true,
      }),
    },
  },
  book_homecoming: {
    id: "book_homecoming",
    catalogKind: "magic",
    name: "Spellbook of Homecoming",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 2,
    rarityName: "magic",
    description: "Grants the ability to instantly return to the surface.",
    weight: 0.7, // spellbook
    hooks: {
      on_use: createLearnSpellFromIdentityHook({
        identityPrefix: "book_",
        consumeOnSuccess: true,
      }),
    },
  },
  book_hearthstone: {
    id: "book_hearthstone",
    catalogKind: "magic",
    name: "Spellbook of Hearthstone",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 3,
    rarityName: "rare",
    description: "Grants the ability to channel your will homeward and be pulled back to safety.",
    weight: 0.7, // spellbook
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
    weight: 1.2, // legendary tome
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
    weight: 0.3, // small book
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
    weight: 0.3, // small book
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
    weight: 0.3, // small book
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
    weight: 0.3, // small book
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
    weight: 0.3, // small book
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
    weight: 0.3, // small book
    flavorText: "The grid bug moves only along cardinal axes. Nobody knows why. One theory suggests they are bound by an ancient curse. Another theory: they are just very stubborn.",
    hooks: {
      on_use: createOpenFlavorBookHook(
        "A Field Guide to Grid Bugs",
        "The grid bug moves only along cardinal axes. Nobody knows why. One theory suggests they are bound by an ancient curse. Another theory: they are just very stubborn.",
      ),
    },
  },
  // ── Spellbooks added for multi-class progression ──────────────────
  book_iron_flesh: {
    id: "book_iron_flesh",
    catalogKind: "magic",
    name: "Spellbook of Iron Flesh",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 2,
    rarityName: "magic",
    description: "Teaches Iron Flesh — harden your body into living metal.",
    weight: 0.7,
    hooks: { on_use: createLearnSpellFromIdentityHook({ identityPrefix: "book_", consumeOnSuccess: true }) },
  },
  book_bloodthirst: {
    id: "book_bloodthirst",
    catalogKind: "magic",
    name: "Spellbook of Bloodthirst",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 3,
    rarityName: "rare",
    description: "Teaches Bloodthirst — each blow heals the striker.",
    weight: 0.7,
    hooks: { on_use: createLearnSpellFromIdentityHook({ identityPrefix: "book_", consumeOnSuccess: true }) },
  },
  book_cleave: {
    id: "book_cleave",
    catalogKind: "magic",
    name: "Spellbook of Cleave",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 2,
    rarityName: "magic",
    description: "Teaches Cleave — a sweeping arc that hits all adjacent foes.",
    weight: 0.7,
    hooks: { on_use: createLearnSpellFromIdentityHook({ identityPrefix: "book_", consumeOnSuccess: true }) },
  },
  book_war_cry: {
    id: "book_war_cry",
    catalogKind: "magic",
    name: "Spellbook of War Cry",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 2,
    rarityName: "magic",
    description: "Teaches War Cry — a shout that weakens nearby enemies.",
    weight: 0.7,
    hooks: { on_use: createLearnSpellFromIdentityHook({ identityPrefix: "book_", consumeOnSuccess: true }) },
  },
  book_barkskin: {
    id: "book_barkskin",
    catalogKind: "magic",
    name: "Spellbook of Barkskin",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 2,
    rarityName: "magic",
    description: "Teaches Barkskin — wrap yourself in living wood for armor and thorns.",
    weight: 0.7,
    hooks: { on_use: createLearnSpellFromIdentityHook({ identityPrefix: "book_", consumeOnSuccess: true }) },
  },
  book_thorn_burst: {
    id: "book_thorn_burst",
    catalogKind: "magic",
    name: "Spellbook of Thorn Burst",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 2,
    rarityName: "magic",
    description: "Teaches Thorn Burst — explode thorns outward from your body.",
    weight: 0.7,
    hooks: { on_use: createLearnSpellFromIdentityHook({ identityPrefix: "book_", consumeOnSuccess: true }) },
  },
  book_entangle: {
    id: "book_entangle",
    catalogKind: "magic",
    name: "Spellbook of Entangle",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 3,
    rarityName: "rare",
    description: "Teaches Entangle — roots bind a target in place.",
    weight: 0.7,
    hooks: { on_use: createLearnSpellFromIdentityHook({ identityPrefix: "book_", consumeOnSuccess: true }) },
  },
  book_quicken: {
    id: "book_quicken",
    catalogKind: "magic",
    name: "Spellbook of Quicken",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 3,
    rarityName: "rare",
    description: "Teaches Quicken — sharpen reflexes, attack faster, recover stamina.",
    weight: 0.7,
    hooks: { on_use: createLearnSpellFromIdentityHook({ identityPrefix: "book_", consumeOnSuccess: true }) },
  },
  book_poison_blade: {
    id: "book_poison_blade",
    catalogKind: "magic",
    name: "Spellbook of Poison Blade",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 2,
    rarityName: "magic",
    description: "Teaches Poison Blade — coat your weapon in venom.",
    weight: 0.7,
    hooks: { on_use: createLearnSpellFromIdentityHook({ identityPrefix: "book_", consumeOnSuccess: true }) },
  },
  book_smoke_bomb: {
    id: "book_smoke_bomb",
    catalogKind: "magic",
    name: "Spellbook of Smoke Bomb",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 3,
    rarityName: "rare",
    description: "Teaches Smoke Bomb — blind nearby foes and vanish.",
    weight: 0.7,
    hooks: { on_use: createLearnSpellFromIdentityHook({ identityPrefix: "book_", consumeOnSuccess: true }) },
  },
  book_mark_of_death: {
    id: "book_mark_of_death",
    catalogKind: "magic",
    name: "Spellbook of Mark of Death",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 3,
    rarityName: "rare",
    description: "Teaches Mark of Death — the marked target takes amplified damage.",
    weight: 0.7,
    hooks: { on_use: createLearnSpellFromIdentityHook({ identityPrefix: "book_", consumeOnSuccess: true }) },
  },
  book_drain_life: {
    id: "book_drain_life",
    catalogKind: "magic",
    name: "Spellbook of Drain Life",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 3,
    rarityName: "rare",
    description: "Teaches Drain Life — siphon vitality from a foe while you channel.",
    weight: 0.7,
    hooks: { on_use: createLearnSpellFromIdentityHook({ identityPrefix: "book_", consumeOnSuccess: true }) },
  },
  book_ignite_weapons: {
    id: "book_ignite_weapons",
    catalogKind: "magic",
    name: "Spellbook of Ignite Weapons",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 2,
    rarityName: "magic",
    description: "Teaches Ignite Weapons — wreath your arms in flame.",
    weight: 0.7,
    hooks: { on_use: createLearnSpellFromIdentityHook({ identityPrefix: "book_", consumeOnSuccess: true }) },
  },
  book_fireball: {
    id: "book_fireball",
    catalogKind: "magic",
    name: "Spellbook of Fireball",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 2,
    rarityName: "magic",
    description: "Teaches Fireball — hurl a ball of fire at range.",
    weight: 0.7,
    hooks: { on_use: createLearnSpellFromIdentityHook({ identityPrefix: "book_", consumeOnSuccess: true }) },
  },
  book_primal_roar: {
    id: "book_primal_roar",
    catalogKind: "magic",
    name: "Spellbook of Primal Roar",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 3,
    rarityName: "rare",
    description: "Teaches Primal Roar — berserk fury staggering everything nearby.",
    weight: 0.7,
    hooks: { on_use: createLearnSpellFromIdentityHook({ identityPrefix: "book_", consumeOnSuccess: true }) },
  },
  book_plague_swarm: {
    id: "book_plague_swarm",
    catalogKind: "magic",
    name: "Spellbook of Plague Swarm",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 4,
    rarityName: "epic",
    description: "Teaches Plague Swarm — unleash a jumping plague of decay.",
    weight: 0.7,
    hooks: { on_use: createLearnSpellFromIdentityHook({ identityPrefix: "book_", consumeOnSuccess: true }) },
  },
  book_divine_shield: {
    id: "book_divine_shield",
    catalogKind: "magic",
    name: "Spellbook of Divine Shield",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 3,
    rarityName: "rare",
    description: "Teaches Divine Shield — a holy ward of stoneskin and blessing.",
    weight: 0.7,
    hooks: { on_use: createLearnSpellFromIdentityHook({ identityPrefix: "book_", consumeOnSuccess: true }) },
  },
  book_purify: {
    id: "book_purify",
    catalogKind: "magic",
    name: "Spellbook of Purify",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 3,
    rarityName: "rare",
    description: "Teaches Purify — cleanse all debuffs from your body.",
    weight: 0.7,
    hooks: { on_use: createLearnSpellFromIdentityHook({ identityPrefix: "book_", consumeOnSuccess: true }) },
  },
  book_consecrate: {
    id: "book_consecrate",
    catalogKind: "magic",
    name: "Spellbook of Consecrate",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 4,
    rarityName: "epic",
    description: "Teaches Consecrate — sanctify the ground, burning the unholy.",
    weight: 0.7,
    hooks: { on_use: createLearnSpellFromIdentityHook({ identityPrefix: "book_", consumeOnSuccess: true }) },
  },
  book_arcane_bolt: {
    id: "book_arcane_bolt",
    catalogKind: "magic",
    name: "Spellbook of Arcane Bolt",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 2,
    rarityName: "magic",
    description: "Teaches Arcane Bolt — a lance of raw arcana that restores mana.",
    weight: 0.7,
    hooks: { on_use: createLearnSpellFromIdentityHook({ identityPrefix: "book_", consumeOnSuccess: true }) },
  },
  book_evocation: {
    id: "book_evocation",
    catalogKind: "magic",
    name: "Spellbook of Evocation",
    type: "learn",
    slot: "bag",
    material: "paper",
    rarity: 3,
    rarityName: "rare",
    description: "Teaches Evocation — channel raw aether to restore mana, but stand vulnerable.",
    weight: 0.7,
    hooks: { on_use: createLearnSpellFromIdentityHook({ identityPrefix: "book_", consumeOnSuccess: true }) },
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
    weight: 0.1, // scroll
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
    weight: 0.5, // hearthstone
    hooks: (() => {
      const _castHook = createCastSpellFromIdentityHook({
        identityPrefix: "",
        targetMode: "self",
        consumeOnSuccess: false,
      });
      return {
        on_use: (ctx, state) => {
          const cd = ctx.query.get(state.itemId, ItemCooldown);
          const turns = resolveItemCooldownRemaining(cd, ctx.query.worldStep());
          if (turns > 0) {
            ctx.io.message(`The hearthstone is still cooling down (${turns} turns).`, 'warning');
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
    weight: 0.1, // scroll
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
    weight: 0.1, // scroll
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
    weight: 0.1, // scroll
    hooks: {
      on_use: createCastSpellFromIdentityHook({
        identityPrefix: "scroll_",
        targetMode: "self",
        consumeOnSuccess: true,
      }),
    },
  },
  scroll_taming: {
    id: "scroll_taming",
    catalogKind: "magic",
    name: "Scroll of Taming",
    type: "scroll",
    slot: "bag",
    material: "paper",
    rarity: 3,
    rarityName: "rare",
    description: "Soft whispers curl from the parchment. A creature that hears them becomes your devoted ally.",
    weight: 0.1,
    hooks: {
      on_use: (ctx, state) => {
        const actor = Number(state?.actor || ctx.actor || 0) | 0;
        ctx.io.emit("scroll:taming", { actor });
        return { consumed: true };
      },
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
    weight: 0.1, // scroll
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
    weight: 0.4, // wand
    hooks: {
      on_use: createCastSpellFromIdentityHook({
        identityPrefix: "wand_",
        targetMode: "intentTarget",
        castEventSource: "wand",
        consumeOnSuccess: true,
      }),
      on_throw: createWandShatterThrowHook({
        element: "electric",
        damagePerCharge: 4,
        radius: 2,
        effectKey: "shocked",
        effectDurationPerCharge: 2,
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
    weight: 0.4, // wand
    hooks: {
      on_use: createCastSpellFromIdentityHook({
        identityPrefix: "wand_",
        targetMode: "intentTarget",
        castEventSource: "wand",
        consumeOnSuccess: true,
      }),
      on_throw: createWandShatterThrowHook({
        element: "fire",
        damagePerCharge: 6,
        radius: 2,
        effectKey: "burning",
        effectDurationPerCharge: 2,
        hazardKind: "fire",
        hazardTurns: 4,
        hazardTickDamage: 3,
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
    weight: 0.4, // wand
    hooks: {
      on_use: createCastSpellFromIdentityHook({
        identityPrefix: "wand_",
        targetMode: "intentTarget",
        castEventSource: "wand",
        consumeOnSuccess: true,
      }),
      on_throw: createWandShatterThrowHook({
        element: "cold",
        damagePerCharge: 2,
        radius: 2,
        effectKey: "frozen",
        effectDurationPerCharge: 2,
      }),
    },
  },
  wand_stasis: {
    id: "wand_stasis",
    catalogKind: "magic",
    name: "Wand of Stasis",
    type: "wand",
    slot: "ranged",
    material: "wood",
    charges: 3,
    rarity: 3,
    rarityName: "rare",
    description: "A pale crystalline rod that hums with temporal energy. Freezes a creature outside of time.",
    weight: 0.4,
    hooks: {
      on_use: (ctx, state) => {
        const actor = Number(state?.actor || ctx.actor || 0) | 0;
        ctx.io.emit("wand:stasis", { actor });
        return { consumed: true };
      },
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
    weight: 0.4, // wand
    hooks: {
      on_use: createCastSpellFromIdentityHook({
        identityPrefix: "wand_",
        targetMode: "target",
        castEventSource: "wand",
        consumeOnSuccess: true,
      }),
      on_throw: createWandShatterThrowHook({
        element: "holy",
        damagePerCharge: 0,
        healPerCharge: 3,
        radius: 2,
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
    noQuickChip: true,
    type: "scroll",
    slot: "bag",
    material: "paper",
    rarity: 1,
    rarityName: "common",
    identified: true,
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
        if (String(targetInfo?.type || "") === "gem") return true;
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
    weight: 0.06, // iron ring
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
    weight: 0.05, // copper ring
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
    weight: 0.09, // lead ring
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
    weight: 0.07, // obsidian ring
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
    weight: 0.05, // silver ring
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
    weight: 0.5, // glass potion
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
      on_throw: createPotionSplashThrowHook({
        effectKey: "poison",
        duration: 8,
        potency: 2,
        damage: 4,
        damageType: "poison",
        sourceKind: "potion_sickness",
      }),
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
    description: "A thick, syrupy liquid that locks every muscle in place. Can be used to coat weapons or arrows.",
    weight: 0.5, // glass potion
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
      on_throw: createPotionSplashThrowHook({
        effectKey: "stun",
        duration: 5,
        potency: 1,
        sourceKind: "potion_paralysis",
      }),
      can_dip_target: canParalysisDipTarget,
      on_dip: createParalysisCoatDipHook({
        chargesGranted: 8,
        coatingColor: "#ccaa44",
        messageTemplate: "You coat $targetName with paralytic venom (+$chargesGranted charges, total $chargesTotal).",
      }),
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
    weight: 0.5, // glass potion
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
      can_dip_target: canParalysisDipTarget, // weapons & ammo
      on_dip: (ctx, state) => {
        const targetInfo = state?.targetInfo;
        if (!targetInfo) return { applied: false, consumedTool: false, resultType: "nothing" };
        const currentCharges = Math.max(0, Number(targetInfo?.coating?.charges || 0) | 0);
        const chargesGranted = 4;
        const nextCharges = currentCharges + chargesGranted;
        const coating = { kind: "hallucination", charges: nextCharges };
        const targetName = resolveApplyTargetName(ctx, state, "weapon");
        ctx.helpers.patchItemInfo(state.targetId, { coating });
        ctx.io.emit("item:applied", { actor: state.actor, toolId: state.toolId, targetId: state.targetId, result: { type: "hallucination_coat", coating, chargesGranted, chargesTotal: nextCharges, message: `You coat ${targetName} with mind-bending vapour (+${chargesGranted} charges, total ${nextCharges}).` } });
        return { applied: true, consumedTool: true, resultType: "hallucination_coat" };
      },
      on_drink: (ctx, state) => {
        const actor = Number(state?.actor || ctx.actor || 0) | 0;
        ctx.io.emit("potion:hallucination", { actor });
        return { consumed: true };
      },
      on_throw: createPotionSplashThrowHook({
        effectKey: "confused",
        duration: 10,
        potency: 1,
        sourceKind: "potion_hallucination",
      }),
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
    weight: 0.5, // glass potion
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
      can_dip_target: canParalysisDipTarget,
      on_dip: (ctx, state) => {
        const targetInfo = state?.targetInfo;
        if (!targetInfo) return { applied: false, consumedTool: false, resultType: "nothing" };
        const currentCharges = Math.max(0, Number(targetInfo?.coating?.charges || 0) | 0);
        const chargesGranted = 6;
        const nextCharges = currentCharges + chargesGranted;
        const coating = { kind: "blindness", charges: nextCharges };
        const targetName = resolveApplyTargetName(ctx, state, "weapon");
        ctx.helpers.patchItemInfo(state.targetId, { coating });
        ctx.io.emit("item:applied", { actor: state.actor, toolId: state.toolId, targetId: state.targetId, result: { type: "blindness_coat", coating, chargesGranted, chargesTotal: nextCharges, message: `You coat ${targetName} with blinding ichor (+${chargesGranted} charges, total ${nextCharges}).` } });
        return { applied: true, consumedTool: true, resultType: "blindness_coat" };
      },
      on_throw: (ctx, state) => {
        const actorId = Number(state?.actor || ctx.actor || 0) | 0;
        const itemId = Number(state?.itemId || ctx.primary || 0) | 0;
        const throwSpec = (state?.throw && typeof state.throw === "object") ? state.throw : null;
        const fallback = ctx.helpers.adjacentPoint(actorId);
        const at = {
          x: Number.isFinite(Number(throwSpec?.to?.x)) ? (Number(throwSpec.to.x) | 0) : (fallback.x | 0),
          y: Number.isFinite(Number(throwSpec?.to?.y)) ? (Number(throwSpec.to.y) | 0) : (fallback.y | 0),
        };
        const hitIds = ctx.query.livingAt(at.x, at.y, {});
        for (const hitId of (Array.isArray(hitIds) ? hitIds : [])) {
          const duration = 10;
          ctx.helpers.addEffect(hitId, {
            key: "blinded",
            potency: 1,
            turnsLeft: duration,
            onsetLeft: 0,
            peakLeft: 0,
            stack: "refresh",
            maxStacks: 1,
            sourceId: itemId,
            meta: { source: "potion_blindness", delivery: "splash" },
          });
          const startValue = Number(ctx.query.effectiveVisionRange(hitId) || 0);
          ctx.mutate.pushEffect(hitId, {
            key: "stat_envelope",
            stat: "visionRange",
            turnsLeft: duration,
            potency: 1,
            startValue,
            toValue: 0,
            endValue: startValue,
            rampIn: 0,
            hold: duration,
            rampOut: 0,
            sourceId: itemId,
            stack: "refresh",
          });
        }
        ctx.io.emit("potion:splash", { at, actorId, sourceKind: "potion_blindness" });
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
    weight: 0.5, // glass potion
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
      can_dip_target: canParalysisDipTarget,
      on_dip: (ctx, state) => {
        const targetInfo = state?.targetInfo;
        if (!targetInfo) return { applied: false, consumedTool: false, resultType: "nothing" };
        const currentCharges = Math.max(0, Number(targetInfo?.coating?.charges || 0) | 0);
        const chargesGranted = 8;
        const nextCharges = currentCharges + chargesGranted;
        const coating = { kind: "weakness", charges: nextCharges };
        const targetName = resolveApplyTargetName(ctx, state, "weapon");
        ctx.helpers.patchItemInfo(state.targetId, { coating });
        ctx.io.emit("item:applied", { actor: state.actor, toolId: state.toolId, targetId: state.targetId, result: { type: "weakness_coat", coating, chargesGranted, chargesTotal: nextCharges, message: `You coat ${targetName} with enervating tincture (+${chargesGranted} charges, total ${nextCharges}).` } });
        return { applied: true, consumedTool: true, resultType: "weakness_coat" };
      },
      on_throw: createPotionSplashThrowHook({
        effectKey: "weakened",
        duration: 20,
        potency: 1,
        sourceKind: "potion_weakness",
      }),
    },
  },
  // ── DerivedExpression Potions ───────────────────────────────────────
  // These potions attach a DerivedExpression child entity to the actor
  // for the buff duration. The expression feeds into the derived stat
  // pipeline (resolveDerivedStats → canonicalStats → combat/regen).
  // On expiry, effectSystem destroys the expr entity via meta.exprEntityId.

  potion_mana_surge: {
    id: "potion_mana_surge",
    catalogKind: "magic",
    name: "Mana Elixir",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 2,
    rarityName: "magic",
    value: 55,
    description: "A luminous azure draught that accelerates mana recovery for several turns.",
    weight: 0.5,
    potion: {
      route: "oral",
      doses: 1,
      channels: [],
      effects: [],
      toxicity: null,
      feel: "Arcane energy crackles through your veins.",
    },
    hooks: {
      on_drink: (ctx, state) => {
        const actorId = Number(state?.actor || ctx.actor || 0) | 0;
        const targetId = ctx.rules.resolveTarget(actorId);
        cleanupPriorExprEntity(ctx, targetId, "mana_surge_expr");
        const exprId = attachDerivedExpression(ctx.world, targetId,
          exprAddConst("manaRegen", 2, { stage: "derived" }));
        ctx.helpers.addEffect(targetId, {
          key: "mana_surge_expr", turnsLeft: 30, potency: 1,
          stack: "refresh", maxStacks: 1,
          meta: { source: "potion_mana_surge", exprEntityId: exprId },
        });
        ctx.io.emit("status", createStatusEvent({
          id: targetId, kind: "buff", effect: "mana_surge",
          source: actorId, masked: !state.identified,
        }));
        return { turns: 30 };
      },
      on_throw: createPotionSplashThrowHook({
        effectKey: "silenced",
        duration: 10,
        potency: 1,
        sourceKind: "potion_mana_surge",
      }),
    },
  },
  potion_keen_edge: {
    id: "potion_keen_edge",
    catalogKind: "magic",
    name: "Potion of Precision",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 3,
    rarityName: "rare",
    value: 70,
    description: "A razor-sharp elixir that hones your instincts, greatly improving critical strike chance.",
    weight: 0.5,
    potion: {
      route: "oral",
      doses: 1,
      channels: [],
      effects: [],
      toxicity: null,
      feel: "Your senses sharpen to a razor's edge.",
    },
    hooks: {
      on_drink: (ctx, state) => {
        const actorId = Number(state?.actor || ctx.actor || 0) | 0;
        const targetId = ctx.rules.resolveTarget(actorId);
        cleanupPriorExprEntity(ctx, targetId, "crit_boost");
        const exprId = attachDerivedExpression(ctx.world, targetId,
          exprAddConst("critChancePhysical", 0.10, { stage: "derived" }));
        ctx.helpers.addEffect(targetId, {
          key: "crit_boost", turnsLeft: 35, potency: 1,
          stack: "refresh", maxStacks: 1,
          meta: { source: "potion_keen_edge", exprEntityId: exprId },
        });
        ctx.io.emit("status", createStatusEvent({
          id: targetId, kind: "buff", effect: "crit_boost",
          source: actorId, masked: !state.identified,
        }));
        return { turns: 35 };
      },
      on_throw: createPotionSplashThrowHook({
        sourceKind: "potion_keen_edge",
        eventName: "potion:splash:dud",
      }),
    },
  },
  potion_lethargy: {
    id: "potion_lethargy",
    catalogKind: "magic",
    name: "Potion of Sluggishness",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 1,
    rarityName: "common",
    value: 5,
    description: "A thick, sluggish grey brew that saps your endurance.",
    weight: 0.5,
    potion: {
      route: "oral",
      doses: 1,
      channels: [],
      effects: [],
      feel: "Your limbs grow heavy and sluggish.",
    },
    hooks: {
      on_drink: (ctx, state) => {
        const actorId = Number(state?.actor || ctx.actor || 0) | 0;
        const targetId = ctx.rules.resolveTarget(actorId);
        cleanupPriorExprEntity(ctx, targetId, "lethargic");
        const exprId = attachDerivedExpression(ctx.world, targetId,
          exprAddConst("staminaRegen", -0.5, { stage: "derived" }));
        ctx.helpers.addEffect(targetId, {
          key: "lethargic", turnsLeft: 30, potency: 1,
          stack: "refresh", maxStacks: 1,
          meta: { source: "potion_lethargy", exprEntityId: exprId },
        });
        ctx.io.emit("potion:lethargy", { actorId });
        return { turns: 30 };
      },
      on_throw: createPotionSplashThrowHook({
        effectKey: "slowed",
        duration: 12,
        potency: 1,
        sourceKind: "potion_lethargy",
      }),
    },
  },

  potion_speed: {
    id: "potion_speed",
    catalogKind: "magic",
    name: "Potion of Speed",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 2,
    rarityName: "magic",
    value: 55,
    description: "A crackling silver draught. Everything slows but you.",
    weight: 0.5,
    potion: {
      route: "oral",
      doses: 1,
      channels: [],
      effects: [],
      toxicity: null,
      feel: "The world snaps into sharp focus. You feel impossibly fast.",
    },
    hooks: {
      on_drink: (ctx, state) => {
        const actorId = Number(state?.actor || ctx.actor || 0) | 0;
        const targetId = ctx.rules.resolveTarget(actorId);
        const turns = ctx.helpers.int(20, 30);
        ctx.helpers.addEffect(targetId, {
          key: "hastened",
          potency: 2,
          turnsLeft: turns,
          onsetLeft: 0,
          peakLeft: 0,
          stack: "refresh",
          maxStacks: 1,
          sourceId: Number(state?.itemId || ctx.primary || 0) | 0,
          meta: { source: "potion_speed", masked: !state.identified },
        });
        ctx.io.emit("potion:speed", { actor: actorId, turns });
        return { hastened: true, turns };
      },
      on_throw: createPotionSplashThrowHook({
        effectKey: "slowed",
        duration: 10,
        potency: 2,
        sourceKind: "potion_speed",
      }),
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
    weight: 0.5, // glass potion
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
      can_dip_target: canParalysisDipTarget,
      on_dip: (ctx, state) => {
        const targetInfo = state?.targetInfo;
        if (!targetInfo) return { applied: false, consumedTool: false, resultType: "nothing" };
        const currentCharges = Math.max(0, Number(targetInfo?.coating?.charges || 0) | 0);
        const chargesGranted = 5;
        const nextCharges = currentCharges + chargesGranted;
        const coating = { kind: "confusion", charges: nextCharges };
        const targetName = resolveApplyTargetName(ctx, state, "weapon");
        ctx.helpers.patchItemInfo(state.targetId, { coating });
        ctx.io.emit("item:applied", { actor: state.actor, toolId: state.toolId, targetId: state.targetId, result: { type: "confusion_coat", coating, chargesGranted, chargesTotal: nextCharges, message: `You coat ${targetName} with disorienting vapour (+${chargesGranted} charges, total ${nextCharges}).` } });
        return { applied: true, consumedTool: true, resultType: "confusion_coat" };
      },
      on_throw: createPotionSplashThrowHook({
        effectKey: "confused",
        duration: 12,
        potency: 1,
        sourceKind: "potion_confusion",
      }),
    },
  },

  // ── Acid Potion ──────────────────────────────────────────────────────
  potion_acid: {
    id: "potion_acid",
    catalogKind: "magic",
    name: "Potion of Acid",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 2,
    rarityName: "magic",
    value: 40,
    weight: 0.5,
    description: "A hissing viridian brew that eats through most things it touches.",
    potion: {
      route: "oral",
      doses: 1,
      channels: [],
      effects: [],
      toxicity: null,
      feel: "Your stomach burns like a forge. Not your best decision.",
    },
    hooks: {
      can_dip_target: canParalysisDipTarget,
      on_dip: (ctx, state) => {
        const targetInfo = state?.targetInfo;
        if (!targetInfo) return { applied: false, consumedTool: false, resultType: "nothing" };
        const currentCharges = Math.max(0, Number(targetInfo?.coating?.charges || 0) | 0);
        const chargesGranted = 8;
        const nextCharges = currentCharges + chargesGranted;
        const coating = { kind: "acid", charges: nextCharges };
        const targetName = resolveApplyTargetName(ctx, state, "weapon");
        ctx.helpers.patchItemInfo(state.targetId, { coating });
        ctx.io.emit("item:applied", { actor: state.actor, toolId: state.toolId, targetId: state.targetId, result: { type: "acid_coat", coating, chargesGranted, chargesTotal: nextCharges, message: `You coat ${targetName} with caustic acid (+${chargesGranted} charges, total ${nextCharges}).` } });
        return { applied: true, consumedTool: true, resultType: "acid_coat" };
      },
      on_drink: (ctx, state) => {
        const actor = Number(state?.actor || ctx.actor || 0) | 0;
        const targetId = ctx.rules.resolveTarget(actor);
        const dmg = ctx.helpers.roll("2d6");
        ctx.helpers.damage(targetId, dmg, "acid");
        ctx.helpers.addEffect(targetId, { key: "burning", potency: 1, turnsLeft: 3, onsetLeft: 0, peakLeft: 0, stack: "refresh", maxStacks: 1, sourceId: Number(state?.itemId || ctx.primary || 0) | 0, meta: { source: "potion_acid" } });
        ctx.io.emit("potion:acid_drink", { actor, damage: dmg });
        return { consumed: true };
      },
      on_throw: createPotionSplashThrowHook({
        effectKey: "burning",
        duration: 3,
        potency: 1,
        sourceKind: "potion_acid",
      }),
    },
  },

  // ── Oil Potion ────────────────────────────────────────────────────────
  potion_oil: {
    id: "potion_oil",
    catalogKind: "magic",
    name: "Flask of Oil",
    type: "potion",
    slot: "bag",
    material: "glass",
    rarity: 2,
    rarityName: "magic",
    value: 30,
    weight: 0.5,
    description: "Thick, flammable oil. Coat a weapon in it, throw it, or drink it (not recommended).",
    potion: {
      route: "oral",
      doses: 1,
      channels: [],
      effects: [],
      toxicity: null,
      feel: "Oily, slick, and deeply wrong. Your throat is now a fire hazard.",
    },
    hooks: {
      can_dip_target: canParalysisDipTarget,
      on_dip: (ctx, state) => {
        const targetInfo = state?.targetInfo;
        if (!targetInfo) return { applied: false, consumedTool: false, resultType: "nothing" };
        const currentCharges = Math.max(0, Number(targetInfo?.coating?.charges || 0) | 0);
        const chargesGranted = 10;
        const nextCharges = currentCharges + chargesGranted;
        const coating = { kind: "oil", charges: nextCharges };
        const targetName = resolveApplyTargetName(ctx, state, "weapon");
        ctx.helpers.patchItemInfo(state.targetId, { coating });
        ctx.io.emit("item:applied", { actor: state.actor, toolId: state.toolId, targetId: state.targetId, result: { type: "oil_coat", coating, chargesGranted, chargesTotal: nextCharges, message: `You slick ${targetName} with oil (+${chargesGranted} charges, total ${nextCharges}).` } });
        return { applied: true, consumedTool: true, resultType: "oil_coat" };
      },
      on_drink: (ctx, state) => {
        const actor = Number(state?.actor || ctx.actor || 0) | 0;
        const targetId = ctx.rules.resolveTarget(actor);
        ctx.helpers.addEffect(targetId, { key: "burning", potency: 2, turnsLeft: 5, onsetLeft: 0, peakLeft: 0, stack: "refresh", maxStacks: 1, sourceId: Number(state?.itemId || ctx.primary || 0) | 0, meta: { source: "potion_oil" } });
        ctx.io.emit("potion:oil_drink", { actor });
        return { consumed: true };
      },
      on_throw: (ctx, state) => {
        const actorId = Number(state?.actor || ctx.actor || 0) | 0;
        const itemId = Number(state?.itemId || ctx.primary || 0) | 0;
        const throwSpec = (state?.throw && typeof state.throw === "object") ? state.throw : null;
        const fallback = ctx.helpers.adjacentPoint(actorId);
        const at = {
          x: Number.isFinite(Number(throwSpec?.to?.x)) ? (Number(throwSpec.to.x) | 0) : (fallback.x | 0),
          y: Number.isFinite(Number(throwSpec?.to?.y)) ? (Number(throwSpec.to.y) | 0) : (fallback.y | 0),
        };
        ctx.helpers.hazardSpawn({
          kind: "fire",
          medium: "floor",
          turnsLeft: 4,
          radius: 1,
          tickDamage: 3,
          damageType: "fire",
          cause: "oil_splash",
          sourceId: actorId,
          sourceKind: "potion_oil",
          identity: "oil_fire",
          name: "Oil Fire",
          meta: { source: "potion_oil", delivery: "thrown" },
        }, at);
        const fromRaw = throwSpec?.from;
        const from = fromRaw ? { x: Number(fromRaw.x) | 0, y: Number(fromRaw.y) | 0 } : null;
        ctx.io.emit("item:thrown", { actor: actorId, itemId, from, to: { ...at }, path: "itemHooks", result: { type: "oil_splash" } });
        ctx.io.emit("potion:oil_splash", { actor: actorId, at });
        return { consumed: true, at, hazardKind: "fire" };
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
    weight: 0.2, // iron amulet
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
    weight: 0.1, // bone amulet
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
    weight: 0.03, // glass ring
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
    weight: 0.09, // lead ring
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
