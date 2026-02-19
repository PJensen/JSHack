// rules/interaction/mutations.js
// ActionTransaction is a rules-layer, action-local commit/discard buffer.
//
// IMPORTANT BOUNDARY:
// - This is NOT an ECS-js scheduler or command queue replacement.
// - ECS-js owns structural deferral via world.command(...) in src/lib/ecs-js/core.js.
// - This module only provides all-or-nothing mutation commits for one action context.
// - Allowed importer in rules code: src/rules/utils/actionContexts.js only.

import { ActiveEffects } from "../components/ActiveEffects.js";
import { Hunger } from "../components/Hunger.js";
import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Potion } from "../components/Potion.js";
import { Resistances } from "../components/Resistences.js";
import { DamageSpec } from "../components/DamageSpec.js";
import { Vitality } from "../components/Vitality.js";
import { dealDamage } from "../utils/dealDamage.js";

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
      let ae = /** @type any */ (world.get(op.entityId, ActiveEffects));
      if (!ae || !Array.isArray(ae.effects)) {
        try { world.add(op.entityId, ActiveEffects, { effects: [] }); } catch {}
        ae = /** @type any */ (world.get(op.entityId, ActiveEffects));
      }
      if (ae && Array.isArray(ae.effects)) {
        ae.effects.push({ stacks: 1, ...op.effect });
      }
      break;
    }
    case "upsertTimedEffect": {
      let ae = /** @type any */ (world.get(op.entityId, ActiveEffects));
      if (!ae || !Array.isArray(ae.effects)) {
        try { world.add(op.entityId, ActiveEffects, { effects: [] }); } catch {}
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
        try { world.add(op.entityId, DamageSpec, { channels: [] }); } catch {}
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
    case "consume": {
      const inv = /** @type any */ (world.get(op.inventoryOwnerId, Inventory));
      if (!inv || !Array.isArray(inv.items)) return;
      const idx = inv.items.indexOf(op.entityId);
      if (idx === -1) return;

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

      inv.items.splice(idx, 1);
      try { world.destroy(op.entityId); } catch {}
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
        try { world.add(op.entityId, Resistances, {}); } catch {}
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
    case "destroy": {
      try { world.destroy(op.entityId); } catch {}
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
 * @typedef {{ type: 'consume', entityId: number, inventoryOwnerId: number }} ConsumeOp
 * @typedef {{ type: 'nutrition', entityId: number, nutrition: number }} NutritionOp
 * @typedef {{ type: 'grantElectricResistance', entityId: number, minOhms?: number, fibrillationA?: number }} GrantElectricResistanceOp
 * @typedef {{ type: 'destroy', entityId: number }} DestroyOp
 * @typedef {DamageOp | HealOp | PushEffectOp | UpsertTimedEffectOp | AppendDamageChannelsOp | PatchItemInfoOp | ConsumeOp | NutritionOp | GrantElectricResistanceOp | DestroyOp} MutationOp
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
