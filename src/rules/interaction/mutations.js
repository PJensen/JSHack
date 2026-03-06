// rules/interaction/mutations.js
// ActionTransaction is a rules-layer, action-local commit/discard buffer.
//
// IMPORTANT BOUNDARY:
// - This is NOT an ECS-js scheduler or command queue replacement.
// - ECS-js owns structural deferral via world.command(...) in src/lib/ecs-js/core.js.
// - This module only provides all-or-nothing mutation commits for one action context.
// - Allowed importer in rules code: src/rules/utils/actionContexts.js only.

import { ActiveEffects } from "../components/ActiveEffects.js";
import { ItemCooldown } from "../components/ItemCooldown.js";
import { EffectImmunities } from "../components/EffectImmunities.js";
import { Equipment } from "../components/Equipment.js";
import { Hunger } from "../components/Hunger.js";
import { addToInventory, inventoryContains, removeFromInventory } from "../utils/inventoryFacade.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Material } from "../components/Material.js";
import { Position } from "../components/Position.js";
import { Potion } from "../components/Potion.js";
import { Resistances } from "../components/Resistences.js";
import { DamageSpec } from "../components/DamageSpec.js";
import { Vitality } from "../components/Vitality.js";
import { Brain } from "../components/Brain.js";
import { Beatitude } from "../components/Beatitude.js";
import { creatureTypeFromTags } from "../components/CreatureType.js";
import { buildCatalogItem } from "../data/itemCatalogLoader.js";
import { getMonster } from "../data/monsters.js";
import { markExplored } from "../environment/dungeon/exploredMap.js";
import { forEachLoadedTile } from "../environment/dungeon/tileMap.js";
import { dealDamage } from "../utils/dealDamage.js";
import { isDotEffectKey, upsertTimedEffect } from "../utils/effectSemantics.js";
import { spawnHazard } from "../utils/hazardSpawn.js";
import { spawnMonsterEntity } from "../utils/spawnMonsterEntity.js";

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
export function applyMutation(world, op) {
  switch (op.type) {
    case "damage": {
      dealDamage(world, {
        target: op.entityId,
        amount: op.amount | 0,
        type: op.damageType || 'generic',
        cause: typeof op.source === 'string' ? op.source : 'item',
        source: typeof op.source === 'number' ? op.source : 0,
      });
      break;
    }
    case "heal": {
      const vit = /** @type any */ (world.get(op.entityId, Vitality));
      if (!vit) return;
      const delta = Math.max(0, op.amount | 0);
      if (delta <= 0) return;
      vit.hp = Math.min(vit.maxHp | 0, (vit.hp | 0) + delta);
      break;
    }
    case "pushEffect": {
      if (isEffectImmune(world, op.entityId, op.effect?.key)) break;
      let ae = /** @type any */ (world.get(op.entityId, ActiveEffects));
      if (!ae || !Array.isArray(ae.effects)) {
        try { world.add(op.entityId, ActiveEffects, { effects: [] }); } catch {} // ECS: may already exist
        ae = /** @type any */ (world.get(op.entityId, ActiveEffects));
      }
      if (ae && Array.isArray(ae.effects)) {
        upsertTimedEffect(ae.effects, { stacks: 1, ...(op.effect || {}) });
      }
      break;
    }
    case "upsertTimedEffect": {
      if (isEffectImmune(world, op.entityId, op.effect?.key)) break;
      let ae = /** @type any */ (world.get(op.entityId, ActiveEffects));
      if (!ae || !Array.isArray(ae.effects)) {
        try { world.add(op.entityId, ActiveEffects, { effects: [] }); } catch {} // ECS: may already exist
        ae = /** @type any */ (world.get(op.entityId, ActiveEffects));
      }
      if (!ae || !Array.isArray(ae.effects)) break;

      const input = op.effect && typeof op.effect === "object" ? op.effect : {};
      const key = String(input.key || "");
      if (!key) break;
      const turnsLeft = Math.max(0, Number(input.turnsLeft ?? input.duration ?? 0) | 0);
      if (turnsLeft <= 0) break;

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
        break;
      }

      if (stack === "refresh" && existing.length > 0) {
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
        break;
      }

      if (stack === "cap" && existing.length >= maxStacks) {
        let strongest = existing[0];
        for (let i = 1; i < existing.length; i++) {
          const rec = existing[i];
          if (Number(rec?.potency || 0) > Number(strongest?.potency || 0)) strongest = rec;
        }
        strongest.turnsLeft = normalized.turnsLeft;
        strongest.startedAtTurn = normalized.startedAtTurn;
        break;
      }

      ae.effects.push(normalized);
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
        try {
          world.emit?.("spawned", {
            id: created,
            kind: "item",
            at: { x: spawnX, y: spawnY },
          });
        } catch (e) { console.debug('[mutations] emit spawned failed:', e); }
      }
      break;
    }
    case "spawnMonster": {
      const monsterId = String(op.monsterId || "");
      if (!monsterId) break;

      const def = getMonster(monsterId);
      if (!def) break;

      const spawnX = Number.isFinite(op.x) ? (Number(op.x) | 0) : 0;
      const spawnY = Number.isFinite(op.y) ? (Number(op.y) | 0) : 0;
      const maxHp = Number.isFinite(op.maxHp) ? (Number(op.maxHp) | 0) : Math.max(1, Number(def.baseHp || 1) | 0);
      const faction = String(op.faction || "enemy");
      const attackDerived = Number.isFinite(op.attackDerived) ? Number(op.attackDerived) : Number(def.attack || 0);
      const defenseDerived = Number.isFinite(op.defenseDerived) ? Number(op.defenseDerived) : Number(def.defense || 0);
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
        attackDerived,
        defenseDerived,
        naturalDamageDice,
        sizeClass: op.sizeClass || def.sizeClass,
        massKg: Number.isFinite(op.massKg) ? Number(op.massKg) : Number(def.massKg || 0),
        resistances,
        speed,
        creatureType: creatureTypeFromTags(def.tags || []),
      });

      if (op.emitEvent !== false) {
        try {
          world.emit?.("spawned", {
            id: spawned,
            kind: "monster",
            at: { x: spawnX, y: spawnY },
          });
        } catch (e) { console.debug('[mutations] emit spawned failed:', e); }
      }

      const tauntMessage = String(op.tauntMessage || "");
      if (tauntMessage) {
        try { world.emit?.("message", { text: tauntMessage, type: "warning" }); } catch (e) { console.debug('[mutations] emit message failed:', e); }
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
        try {
          world.emit?.("item:dropped", {
            actor: op.inventoryOwnerId | 0,
            itemId: op.entityId | 0,
            count,
            at: { x, y },
          });
        } catch (e) { console.debug('[mutations] emit item:dropped failed:', e); }
      }
      break;
    }
    case "nutrition": {
      const hc = /** @type any */ (world.get(op.entityId, Hunger));
      if (!hc) return;
      const nutrition = Number(op.nutrition || 0);
      if (!Number.isFinite(nutrition) || nutrition === 0) return;
      const newHunger = Number(hc.hunger || 0) - nutrition;
      if (newHunger < 0) {
        hc.satiation = Math.min(Number(hc.satiation || 0) + Math.abs(newHunger), 200);
        hc.hunger = 0;
      } else {
        hc.hunger = newHunger;
      }
      break;
    }
    case "grantElectricResistance": {
      let resist = /** @type any */ (world.get(op.entityId, Resistances));
      if (!resist) {
        try { world.add(op.entityId, Resistances, {}); } catch {} // ECS: may already exist
        resist = /** @type any */ (world.get(op.entityId, Resistances));
      }
      if (!resist) return;
      const minOhms = Number.isFinite(op.minOhms) ? Number(op.minOhms) : 2400;
      const current = Number(resist?.electric?.ohms);
      const nextOhms = Number.isFinite(current) ? Math.max(current, minOhms) : minOhms;
      if (!resist.electric || typeof resist.electric !== "object") resist.electric = {};
      resist.electric.ohms = nextOhms;
      if (!Number.isFinite(resist.electric.fibrillationA)) {
        resist.electric.fibrillationA = Number.isFinite(op.fibrillationA) ? Number(op.fibrillationA) : 0.03;
      }
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
      if (!(turns > 0)) break;
      let cd = /** @type any */ (world.get(op.entityId, ItemCooldown));
      if (!cd) {
        try { world.add(op.entityId, ItemCooldown, { turnsRemaining: turns, turnsMax: turns }); } catch {} // ECS: may already exist
        cd = /** @type any */ (world.get(op.entityId, ItemCooldown));
      }
      if (cd) {
        cd.turnsRemaining = turns;
        cd.turnsMax = turns;
      }
      break;
    }
    case "destroy": {
      try { world.destroy(op.entityId); } catch {} // ECS: entity may already be destroyed
      break;
    }
  }
}

/**
 * @typedef {{ type: 'damage', entityId: number, amount: number, source: string }} DamageOp
 * @typedef {{ type: 'heal', entityId: number, amount: number }} HealOp
 * @typedef {{ type: 'pushEffect', entityId: number, effect: { key: string, turnsLeft: number, potency: number, stacks?: number, sourceId?: number } }} PushEffectOp
 * @typedef {{ type: 'upsertTimedEffect', entityId: number, effect: { key: string, potency: number, onsetLeft?: number, onset?: number, peakLeft?: number, peak?: number, turnsLeft?: number, duration?: number, stack?: string, maxStacks?: number, sourceId?: number, startedAtTurn?: number, meta?: Record<string, unknown> } }} UpsertTimedEffectOp
 * @typedef {{ type: 'appendDamageChannels', entityId: number, channels: Array<Record<string, unknown>> }} AppendDamageChannelsOp
 * @typedef {{ type: 'patchItemInfo', entityId: number, patch: Record<string, unknown> }} PatchItemInfoOp
 * @typedef {{ type: 'setBeatitude', entityId: number, state: 'blessed'|'uncursed'|'cursed' }} SetBeatitudeOp
 * @typedef {{ type: 'removeTimedEffectsByKey', entityId: number, keys: string[] }} RemoveTimedEffectsByKeyOp
 * @typedef {{ type: 'setMaterial', entityId: number, kind: string }} SetMaterialOp
 * @typedef {{ type: 'spawnItem', itemId: string, x?: number, y?: number, count?: number, affixes?: string[], ownerId?: number, material?: string, patchItemInfo?: Record<string, unknown>, emitEvent?: boolean }} SpawnItemOp
 * @typedef {{ type: 'spawnMonster', monsterId: string, x: number, y: number, name?: string, faction?: string, maxHp?: number, attackDerived?: number, defenseDerived?: number, naturalDamageDice?: string, sizeClass?: string, massKg?: number, resistances?: Record<string, unknown>, speed?: number, tauntMessage?: string, emitEvent?: boolean }} SpawnMonsterOp
 * @typedef {{ type: 'learnSpell', entityId: number, spellId: string }} LearnSpellOp
 * @typedef {{ type: 'consume', entityId: number, inventoryOwnerId: number }} ConsumeOp
 * @typedef {{ type: 'dropFromInventory', entityId: number, inventoryOwnerId: number, x: number, y: number, emitEvent?: boolean }} DropFromInventoryOp
 * @typedef {{ type: 'nutrition', entityId: number, nutrition: number }} NutritionOp
 * @typedef {{ type: 'grantElectricResistance', entityId: number, minOhms?: number, fibrillationA?: number }} GrantElectricResistanceOp
 * @typedef {{ type: 'revealLoadedMap' }} RevealLoadedMapOp
 * @typedef {{ type: 'spawnHazard', spec: Record<string, unknown> }} SpawnHazardOp
 * @typedef {{ type: 'destroy', entityId: number }} DestroyOp
 * @typedef {{ type: 'setItemCooldown', entityId: number, turns: number }} SetItemCooldownOp
 * @typedef {DamageOp | HealOp | PushEffectOp | UpsertTimedEffectOp | AppendDamageChannelsOp | PatchItemInfoOp | SetBeatitudeOp | RemoveTimedEffectsByKeyOp | SetMaterialOp | SpawnItemOp | SpawnMonsterOp | LearnSpellOp | ConsumeOp | DropFromInventoryOp | NutritionOp | GrantElectricResistanceOp | RevealLoadedMapOp | SpawnHazardOp | DestroyOp | SetItemCooldownOp} MutationOp
 */

export class ActionTransaction {
  constructor() {
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
      applyMutation(world, this._ops[i]);
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
