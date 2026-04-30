// rules/interaction/mutations.js
// ActionTransaction is a rules-layer, action-local commit/discard buffer.
//
// IMPORTANT BOUNDARY:
// - This is NOT an ECS-js scheduler or command queue replacement.
// - ECS-js owns structural deferral via world.command(...) in src/lib/ecs-js/core.js.
// - This module only provides all-or-nothing mutation commits for one action context.
// - Allowed importer in rules code: src/rules/utils/actionContexts.js only.

import { attach } from "../../lib/ecs-js/index.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { CorpseAdaptation } from "../components/CorpseAdaptation.js";
import { DerivedExpression } from "../components/DerivedExpression.js";
import { EffectImmunities } from "../components/EffectImmunities.js";
import { Equipment } from "../components/Equipment.js";
import { Hunger } from "../components/Hunger.js";
import { addToInventory, inventoryContains, removeFromInventory } from "../utils/inventoryFacade.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Material } from "../components/Material.js";
import { Position } from "../components/Position.js";
import { Potion } from "../components/Potion.js";

import { DamageSpec } from "../components/DamageSpec.js";
import { Vitality } from "../components/Vitality.js";
import { Brain } from "../components/Brain.js";
import { Beatitude } from "../components/Beatitude.js";
import { creatureTypeFromTags } from "../components/CreatureType.js";
import { markExplored } from "../environment/dungeon/exploredMap.js";
import { forEachLoadedTile } from "../environment/dungeon/tileMap.js";
import { dealDamage } from "../utils/dealDamage.js";
import { isDotEffectKey, upsertTimedEffect } from "../utils/effectSemantics.js";
import { applyStatusEffect, ensureActiveEffects, isInvulnerabilityEffectKey } from "../utils/effects.js";
import { attachEnchantmentNode } from "../utils/enchantmentTopology.js";
import { spawnHazard } from "../utils/hazardSpawn.js";
import { spawnMonsterEntity } from "../utils/spawnMonsterEntity.js";
import { setItemCooldown } from "../utils/itemCooldowns.js";
import { Traits } from "../components/Traits.js";
import { getHungerLevel } from "../data/food.js";
import { effectiveMaxHp } from "../utils/passiveBonuses.js";
import { emitSafe } from "../utils/emitSafe.js";

/**
 * @param {any} world
 * @param {number} entityId
 * @param {string | undefined} effectKey
 * @returns {boolean}
 */
function isEffectImmune(world, entityId, effectKey) {
  if (!effectKey) return false;
  const imm = /** @type any */ (world.get(entityId, EffectImmunities));
  return Array.isArray(imm?.immuneTo) && imm.immuneTo.includes(effectKey);
}

/**
 * Apply a single mutation op to the world.
 * Extracted from the direct-mutation logic formerly in RuleActionContext.
 * @param {any} world
 * @param {MutationOp} op
 */
export function applyMutation(world, op, resolvers = {}) {
  switch (op.type) {
    case "damage": {
      dealDamage(world, {
        target: op.entityId,
        amount: op.amount | 0,
        type: op.damageType || 'generic',
        cause: typeof op.source === 'string' ? op.source : 'item',
        source: typeof op.source === 'number' ? op.source : 0,
        projectileDelay: Number(op.projectileDelay || 0),
      });
      break;
    }
    case "heal": {
      const vit = /** @type any */ (world.get(op.entityId, Vitality));
      if (!vit) return;
      const delta = Math.max(0, op.amount | 0);
      if (delta <= 0) return;
      vit.hp = Math.min(effectiveMaxHp(world, op.entityId, vit), (vit.hp | 0) + delta);
      break;
    }
    case "pushEffect": {
      if (isEffectImmune(world, op.entityId, op.effect?.key)) break;
      if (isInvulnerabilityEffectKey(op.effect?.key)) {
        applyStatusEffect(world, op.entityId, { stacks: 1, ...(op.effect || {}) });
        break;
      }
      const ae = ensureActiveEffects(world, op.entityId);
      if (ae) {
        upsertTimedEffect(ae.effects, { stacks: 1, ...(op.effect || {}) });
      }
      break;
    }
    case "upsertTimedEffect": {
      if (isEffectImmune(world, op.entityId, op.effect?.key)) break;
      const ae = ensureActiveEffects(world, op.entityId);
      if (!ae) break;

      const input = op.effect && typeof op.effect === "object" ? op.effect : {};
      const key = String(input.key || "");
      if (!key) break;
      const turnsLeft = Math.max(0, Number(input.turnsLeft ?? input.duration ?? 0) | 0);
      if (turnsLeft <= 0) break;
      if (isInvulnerabilityEffectKey(key)) {
        applyStatusEffect(world, op.entityId, {
          ...input,
          key,
          turnsLeft,
          potency: Number(input.potency || 0),
          onsetLeft: Math.max(0, Number(input.onsetLeft ?? input.onset ?? 0) | 0),
          startedAtTurn: Number.isFinite(input.startedAtTurn) ? (input.startedAtTurn | 0) : (world.step | 0),
          sourceId: Number(input.sourceId || 0) | 0,
        });
        break;
      }

      const normalized = {
        key,
        potency: Number(input.potency || 0),
        onsetLeft: Math.max(0, Number(input.onsetLeft ?? input.onset ?? 0) | 0),
        peakLeft: Math.max(0, Number(input.peakLeft ?? input.peak ?? 0) | 0),
        turnsLeft,
        startedAtTurn: Number.isFinite(input.startedAtTurn) ? (input.startedAtTurn | 0) : (world.step | 0),
        sourceId: Number(input.sourceId || 0) | 0,
        meta: (input.meta && typeof input.meta === "object") ? { ...input.meta } : {},
      };

      const stack = String(input.stack || "add");
      const maxStacks = Math.max(1, Number(input.maxStacks ?? 1) | 0);
      const existing = ae.effects.filter((x) => String(x?.key || "") === key);

      // DOT semantics are refresh-only across all entry points.
      if (isDotEffectKey(key)) {
        upsertTimedEffect(ae.effects, normalized);
      } else if (stack === "refresh" && existing.length > 0) {
        for (let i = 0; i < existing.length; i++) {
          const rec = existing[i];
          rec.potency = normalized.potency;
          rec.onsetLeft = normalized.onsetLeft;
          rec.peakLeft = normalized.peakLeft;
          rec.turnsLeft = normalized.turnsLeft;
          rec.startedAtTurn = normalized.startedAtTurn;
          rec.sourceId = normalized.sourceId;
          rec.meta = normalized.meta;
        }
      } else if (stack === "cap" && existing.length >= maxStacks) {
        let strongest = existing[0];
        for (let i = 1; i < existing.length; i++) {
          const rec = existing[i];
          if (Number(rec?.potency || 0) > Number(strongest?.potency || 0)) strongest = rec;
        }
        strongest.turnsLeft = normalized.turnsLeft;
        strongest.startedAtTurn = normalized.startedAtTurn;
      } else {
        ae.effects.push(normalized);
      }
      break;
    }
    case "appendDamageChannels": {
      const incoming = Array.isArray(op.channels) ? op.channels : [];
      if (incoming.length === 0) break;
      let spec = /** @type any */ (world.get(op.entityId, DamageSpec));
      if (!spec || !Array.isArray(spec.channels)) {
        try { world.add(op.entityId, DamageSpec, { channels: [] }); } catch {} // ECS: may already exist
        spec = /** @type any */ (world.get(op.entityId, DamageSpec));
      }
      if (!spec || !Array.isArray(spec.channels)) break;
      for (let i = 0; i < incoming.length; i++) {
        const channel = incoming[i];
        if (!channel || typeof channel !== "object") continue;
        spec.channels.push({ ...channel });
      }
      break;
    }
    case "patchItemInfo": {
      const info = /** @type any */ (world.get(op.entityId, ItemInfo));
      if (!info || !op.patch || typeof op.patch !== "object") break;
      const patch = /** @type Record<string, unknown> */ (op.patch);
      const keys = Object.keys(patch);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const value = patch[key];
        if (value && typeof value === "object") {
          info[key] = Array.isArray(value) ? value.slice() : { ...value };
          continue;
        }
        info[key] = value;
      }
      break;
    }
    case "attachEnchantment": {
      attachEnchantmentNode(world, op.entityId, op.def || {});
      break;
    }
    case "setBeatitude": {
      const state = String(op.state || "").toLowerCase();
      if (state !== "blessed" && state !== "uncursed" && state !== "cursed") break;
      let beatitude = /** @type any */ (world.get(op.entityId, Beatitude));
      if (!beatitude) {
        try { world.add(op.entityId, Beatitude, { state }); } catch {} // ECS: may already exist
        beatitude = /** @type any */ (world.get(op.entityId, Beatitude));
      }
      if (beatitude) beatitude.state = state;
      break;
    }
    case "removeTimedEffectsByKey": {
      const ae = /** @type any */ (world.get(op.entityId, ActiveEffects));
      if (!ae || !Array.isArray(ae.effects)) break;
      const keys = new Set(
        Array.isArray(op.keys)
          ? op.keys.map((k) => String(k || "").toLowerCase()).filter(Boolean)
          : [],
      );
      if (keys.size <= 0) break;
      ae.effects = ae.effects.filter((effect) => !keys.has(String(effect?.key || "").toLowerCase()));
      break;
    }
    case "setMaterial": {
      const kind = String(op.kind || "");
      if (!kind) break;
      let material = /** @type any */ (world.get(op.entityId, Material));
      if (!material) {
        try { world.add(op.entityId, Material, { kind }); } catch {} // ECS: may already exist
        material = /** @type any */ (world.get(op.entityId, Material));
      }
      if (material) material.kind = kind;
      break;
    }
    case "spawnItem": {
      const itemId = String(op.itemId || "");
      if (!itemId) break;

      const buildCatalogItem = resolvers.buildCatalogItem;
      if (typeof buildCatalogItem !== "function") break;
      let created = 0;
      try {
        created = buildCatalogItem(world, itemId, {
          count: Number(op.count || 0) | 0,
          affixes: Array.isArray(op.affixes) ? op.affixes.slice() : [],
        });
      } catch {
        created = 0;
      }
      if (!(created > 0)) break;

      const hasX = Number.isFinite(op.x);
      const hasY = Number.isFinite(op.y);
      const spawnX = hasX ? (Number(op.x) | 0) : 0;
      const spawnY = hasY ? (Number(op.y) | 0) : 0;
      if (hasX && hasY) {
        if (world.has(created, Position)) {
          try { world.set(created, Position, { x: spawnX, y: spawnY }); } catch {} // ECS: component may not exist
        } else {
          try { world.add(created, Position, { x: spawnX, y: spawnY }); } catch {} // ECS: may already exist
        }
      }

      const patchInfo = op.patchItemInfo && typeof op.patchItemInfo === "object"
        ? /** @type Record<string, unknown> */ (op.patchItemInfo)
        : null;
      if (patchInfo) {
        const info = /** @type any */ (world.get(created, ItemInfo));
        if (info) {
          const keys = Object.keys(patchInfo);
          for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const value = patchInfo[key];
            if (value && typeof value === "object") {
              info[key] = Array.isArray(value) ? value.slice() : { ...value };
              continue;
            }
            info[key] = value;
          }
        }
      }

      const materialKind = String(op.material || "");
      if (materialKind) {
        let material = /** @type any */ (world.get(created, Material));
        if (!material) {
          try { world.add(created, Material, { kind: materialKind }); } catch {} // ECS: may already exist
          material = /** @type any */ (world.get(created, Material));
        }
        if (material) material.kind = materialKind;
      }

      const ownerId = op.ownerId | 0;
      if (ownerId > 0) {
        addToInventory(world, ownerId, created);
      }

      if (op.emitEvent !== false) {
        emitSafe(world, "spawned", {
          id: created,
          kind: "item",
          at: { x: spawnX, y: spawnY },
        });
      }
      break;
    }
    case "spawnMonster": {
      const monsterId = String(op.monsterId || "");
      if (!monsterId) break;

      const getMonster = resolvers.getMonster;
      if (typeof getMonster !== "function") break;
      const def = getMonster(monsterId);
      if (!def) break;

      const spawnX = Number.isFinite(op.x) ? (Number(op.x) | 0) : 0;
      const spawnY = Number.isFinite(op.y) ? (Number(op.y) | 0) : 0;
      const maxHp = Number.isFinite(op.maxHp) ? (Number(op.maxHp) | 0) : Math.max(1, Number(def.baseHp || 1) | 0);
      const faction = String(op.faction || "enemy");
      const accuracyDerived = Number.isFinite(op.accuracyDerived)
        ? Number(op.accuracyDerived)
        : Number(def.attack || 0);
      const damagePowerDerived = Number.isFinite(op.damagePowerDerived)
        ? Number(op.damagePowerDerived)
        : Number(def.attack || 0);
      const evadeDerived = Number.isFinite(op.evadeDerived)
        ? Number(op.evadeDerived)
        : Number(def.defense || 0);
      const naturalDamageDice = String(op.naturalDamageDice || def.damageDice || "1d2");
      const speed = Number.isFinite(op.speed) ? Number(op.speed) : Number(def.speed || 1);
      const resistances = (op.resistances && typeof op.resistances === "object")
        ? { ...op.resistances }
        : ((def.resistances && typeof def.resistances === "object") ? { ...def.resistances } : {});
      const spawned = spawnMonsterEntity(world, {
        x: spawnX,
        y: spawnY,
        name: String(op.name || def.name || monsterId),
        identity: monsterId,
        maxHp,
        faction,
        accuracyDerived,
        damagePowerDerived,
        evadeDerived,
        naturalDamageDice,
        sizeClass: op.sizeClass || def.sizeClass,
        massKg: Number.isFinite(op.massKg) ? Number(op.massKg) : Number(def.massKg || 0),
        resistances,
        speed,
        equipment: op.equipment || def.equipment || null,
        wielding: Array.isArray(op.wielding) ? op.wielding.slice() : (Array.isArray(def.wielding) ? def.wielding.slice() : []),
        equipped: Array.isArray(op.equipped) ? op.equipped.slice() : (Array.isArray(def.equipped) ? def.equipped.slice() : []),
        inventory: Array.isArray(op.inventory) ? op.inventory.slice() : (Array.isArray(def.inventory) ? def.inventory.slice() : []),
        learnedSpellIds: Array.isArray(op.learnedSpellIds)
          ? op.learnedSpellIds.slice()
          : (Array.isArray(def.learnedSpellIds) ? def.learnedSpellIds.slice() : []),
        maxMana: Number.isFinite(op.maxMana) ? Number(op.maxMana) : Number(def.maxMana || 0),
        manaRegen: Number.isFinite(op.manaRegen) ? Number(op.manaRegen) : Number(def.manaRegen || 0),
        creatureType: creatureTypeFromTags(def.tags || []),
      });

      if (op.emitEvent !== false) {
        emitSafe(world, "spawned", {
          id: spawned,
          kind: "monster",
          at: { x: spawnX, y: spawnY },
        });
      }

      const tauntMessage = String(op.tauntMessage || "");
      if (tauntMessage) {
        emitSafe(world, "message", { text: tauntMessage, type: "warning" });
      }
      break;
    }
    case "learnSpell": {
      const spellId = String(op.spellId || "");
      if (!spellId) break;
      let brain = /** @type any */ (world.get(op.entityId, Brain));
      if (!brain) {
        try { world.add(op.entityId, Brain, {}); } catch {} // ECS: may already exist
        brain = /** @type any */ (world.get(op.entityId, Brain));
      }
      if (!brain) break;
      if (!Array.isArray(brain.learnedSpellIds)) brain.learnedSpellIds = [];
      if (!brain.learnedSpellIds.includes(spellId)) brain.learnedSpellIds.push(spellId);
      break;
    }
    case "consume": {
      if (!inventoryContains(world, op.inventoryOwnerId, op.entityId)) return;

      const potion = /** @type any */ (world.get(op.entityId, Potion));
      if (potion && Number.isFinite(potion.doses) && (potion.doses | 0) > 1) {
        potion.doses = (potion.doses | 0) - 1;
        return;
      }

      const info = /** @type any */ (world.get(op.entityId, ItemInfo));
      if (info && Number.isFinite(info.count) && (info.count | 0) > 1) {
        info.count = (info.count | 0) - 1;
        if (potion) potion.doses = 1;
        return;
      }

      removeFromInventory(world, op.inventoryOwnerId, op.entityId);
      try { world.destroy(op.entityId); } catch {} // ECS: entity may already be destroyed
      break;
    }
    case "dropFromInventory": {
      if (!inventoryContains(world, op.inventoryOwnerId, op.entityId)) return;

      removeFromInventory(world, op.inventoryOwnerId, op.entityId);

      const x = Number.isFinite(op.x) ? (Number(op.x) | 0) : 0;
      const y = Number.isFinite(op.y) ? (Number(op.y) | 0) : 0;
      if (world.has(op.entityId, Position)) {
        try { world.set(op.entityId, Position, { x, y }); } catch {} // ECS: component may not exist
      } else {
        try { world.add(op.entityId, Position, { x, y }); } catch {} // ECS: may already exist
      }

      if (op.emitEvent !== false) {
        const info = /** @type any */ (world.get(op.entityId, ItemInfo));
        const count = Math.max(1, Number(info?.count || 1) | 0);
        emitSafe(world, "item:dropped", {
          actor: op.inventoryOwnerId | 0,
          itemId: op.entityId | 0,
          count,
          at: { x, y },
        });
      }
      break;
    }
    case "nutrition": {
      const hc = /** @type any */ (world.get(op.entityId, Hunger));
      if (!hc) return;
      const nutrition = Number(op.nutrition || 0);
      if (!Number.isFinite(nutrition) || nutrition === 0) return;
      // Eating while starving/wasting: choke on food (1-turn stun), but still gain nutrition
      const prevLevel = getHungerLevel(Number(hc.hunger || 0));
      if ((prevLevel === 'starving' || prevLevel === 'wasting') && nutrition > 0) {
        const ae = ensureActiveEffects(world, op.entityId);
        if (ae) {
          ae.effects.push({ key: 'stun', turnsLeft: 2, potency: 1, stacks: 1 });
          emitSafe(world, 'hunger:choke', { id: op.entityId });
        }
      }
      const newHunger = Number(hc.hunger || 0) - nutrition;
      if (newHunger < 0) {
        hc.satiation = Math.min(Number(hc.satiation || 0) + Math.abs(newHunger), 200);
        hc.hunger = 0;
      } else {
        hc.hunger = newHunger;
      }
      break;
    }
    case "setTrait": {
      const key = String(op.key || "");
      if (!key) break;
      let tr = /** @type any */ (world.get(op.entityId, Traits));
      if (!tr) {
        try { world.add(op.entityId, Traits, {}); } catch {}
        tr = /** @type any */ (world.get(op.entityId, Traits));
      }
      if (tr) tr[key] = op.value;
      break;
    }
    case "addCorpseAdaptation": {
      const statKey = String(op.statKey || "");
      const value = Number(op.value || 0);
      if (!statKey || !Number.isFinite(value) || value === 0) break;
      const childId = world.create();
      world.add(childId, DerivedExpression, {
        target: statKey, kind: "addConst", value,
        stage: "base", priority: 100, enabled: true,
        source: "", factor: 0,
      });
      world.add(childId, CorpseAdaptation, {
        source: String(op.source || ""),
        label: String(op.label || ""),
        statKey,
      });
      attach(world, childId, op.entityId);
      break;
    }
    case "revealLoadedMap": {
      forEachLoadedTile((x, y) => markExplored(x, y));
      break;
    }
    case "spawnHazard": {
      const spec = (op.spec && typeof op.spec === "object")
        ? { ...op.spec }
        : {};
      spawnHazard(world, /** @type any */ (spec));
      break;
    }
    case "setItemCooldown": {
      const turns = Math.max(0, Number(op.turns || 0) | 0);
      setItemCooldown(world, op.entityId | 0, turns);
      break;
    }
    case "destroy": {
      try { world.destroy(op.entityId); } catch {} // ECS: entity may already be destroyed
      break;
    }
  }
}

/**
 * @typedef {{ type: 'damage', entityId: number, amount: number, source: string|number, projectileDelay?: number }} DamageOp
 * @typedef {{ type: 'heal', entityId: number, amount: number }} HealOp
 * @typedef {{ type: 'pushEffect', entityId: number, effect: { key: string, turnsLeft: number, potency: number, stacks?: number, sourceId?: number } }} PushEffectOp
 * @typedef {{ type: 'upsertTimedEffect', entityId: number, effect: { key: string, potency: number, onsetLeft?: number, onset?: number, peakLeft?: number, peak?: number, turnsLeft?: number, duration?: number, stack?: string, maxStacks?: number, sourceId?: number, startedAtTurn?: number, meta?: Record<string, unknown> } }} UpsertTimedEffectOp
 * @typedef {{ type: 'appendDamageChannels', entityId: number, channels: Array<Record<string, unknown>> }} AppendDamageChannelsOp
 * @typedef {{ type: 'patchItemInfo', entityId: number, patch: Record<string, unknown> }} PatchItemInfoOp
 * @typedef {{ type: 'attachEnchantment', entityId: number, def: Record<string, unknown> }} AttachEnchantmentOp
 * @typedef {{ type: 'setBeatitude', entityId: number, state: 'blessed'|'uncursed'|'cursed' }} SetBeatitudeOp
 * @typedef {{ type: 'removeTimedEffectsByKey', entityId: number, keys: string[] }} RemoveTimedEffectsByKeyOp
 * @typedef {{ type: 'setMaterial', entityId: number, kind: string }} SetMaterialOp
 * @typedef {{ type: 'spawnItem', itemId: string, x?: number, y?: number, count?: number, affixes?: string[], ownerId?: number, material?: string, patchItemInfo?: Record<string, unknown>, emitEvent?: boolean }} SpawnItemOp
 * @typedef {{ type: 'spawnMonster', monsterId: string, x: number, y: number, name?: string, faction?: string, maxHp?: number, accuracyDerived?: number, damagePowerDerived?: number, evadeDerived?: number, naturalDamageDice?: string, sizeClass?: string, massKg?: number, resistances?: Record<string, unknown>, speed?: number, tauntMessage?: string, emitEvent?: boolean, equipment?: Record<string, unknown>|null, wielding?: Array<unknown>, equipped?: Array<unknown>, inventory?: Array<unknown> }} SpawnMonsterOp
 * @typedef {{ type: 'learnSpell', entityId: number, spellId: string }} LearnSpellOp
 * @typedef {{ type: 'consume', entityId: number, inventoryOwnerId: number }} ConsumeOp
 * @typedef {{ type: 'dropFromInventory', entityId: number, inventoryOwnerId: number, x: number, y: number, emitEvent?: boolean }} DropFromInventoryOp
 * @typedef {{ type: 'nutrition', entityId: number, nutrition: number }} NutritionOp
 * @typedef {{ type: 'addCorpseAdaptation', entityId: number, statKey: string, value: number, source: string, label: string }} AddCorpseAdaptationOp
 * @typedef {{ type: 'revealLoadedMap' }} RevealLoadedMapOp
 * @typedef {{ type: 'spawnHazard', spec: Record<string, unknown> }} SpawnHazardOp
 * @typedef {{ type: 'destroy', entityId: number }} DestroyOp
 * @typedef {{ type: 'setItemCooldown', entityId: number, turns: number }} SetItemCooldownOp
 * @typedef {DamageOp | HealOp | PushEffectOp | UpsertTimedEffectOp | AppendDamageChannelsOp | PatchItemInfoOp | AttachEnchantmentOp | SetBeatitudeOp | RemoveTimedEffectsByKeyOp | SetMaterialOp | SpawnItemOp | SpawnMonsterOp | LearnSpellOp | ConsumeOp | DropFromInventoryOp | NutritionOp | AddCorpseAdaptationOp | RevealLoadedMapOp | SpawnHazardOp | DestroyOp | SetItemCooldownOp} MutationOp
 */

export class ActionTransaction {
  /** @param {Record<string, Function>} [resolvers] */
  constructor(resolvers = {}) {
    this._resolvers = resolvers;
    /** @type {MutationOp[]} */
    this._ops = [];
    this._cancelled = false;
    /** @type {{ code: string, message: string, consumesTurn?: boolean } | null} */
    this._cancelReason = null;
  }

  get cancelled() { return this._cancelled; }
  get cancelReason() { return this._cancelReason; }
  get length() { return this._ops.length; }
  get ops() { return this._ops; }

  /**
   * @param {{ code: string, message: string, consumesTurn?: boolean } | string} reason
   */
  cancel(reason) {
    this._cancelled = true;
    this._cancelReason = typeof reason === "string"
      ? { code: "cancelled", message: reason }
      : (reason || { code: "cancelled", message: "" });
  }

  /** @param {MutationOp} op */
  enqueue(op) {
    this._ops.push(op);
  }

  /**
   * Apply all queued mutations to the world. No-op if cancelled.
   * @param {any} world
   * @returns {MutationOp[]} applied ops (empty if cancelled)
   */
  commit(world) {
    if (this._cancelled) return [];
    const applied = [];
    for (let i = 0; i < this._ops.length; i++) {
      applyMutation(world, this._ops[i], this._resolvers);
      applied.push(this._ops[i]);
    }
    this._ops.length = 0;
    return applied;
  }

  /**
   * Discard all queued mutations without applying.
   * @returns {MutationOp[]} discarded ops
   */
  discard() {
    const discarded = this._ops.slice();
    this._ops.length = 0;
    return discarded;
  }
}
