// rules/interaction/mutations.js
// Append-only mutation queue for deferred world changes.
// Callbacks enqueue ops; systems commit or discard after checking cancellation.

import { ActiveEffects } from "../components/ActiveEffects.js";
import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Potion } from "../components/Potion.js";
import { Vitality } from "../components/Vitality.js";

/**
 * Apply a single mutation op to the world.
 * Extracted from the direct-mutation logic formerly in RuleActionContext.
 * @param {any} world
 * @param {MutationOp} op
 */
export function applyMutation(world, op) {
  switch (op.type) {
    case "damage": {
      const vit = /** @type any */ (world.get(op.entityId, Vitality));
      if (!vit) return;
      const dealt = Math.max(0, op.amount | 0);
      if (dealt <= 0) return;
      vit.hp = Math.max(0, (vit.hp | 0) - dealt);
      try { world.emit?.("damage", { id: op.entityId, amount: dealt, source: op.source }); } catch {}
      if ((vit.hp | 0) <= 0) {
        try { world.emit?.("died", { id: op.entityId, cause: op.source }); } catch {}
      }
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
 * @typedef {{ type: 'consume', entityId: number, inventoryOwnerId: number }} ConsumeOp
 * @typedef {{ type: 'destroy', entityId: number }} DestroyOp
 * @typedef {DamageOp | HealOp | PushEffectOp | ConsumeOp | DestroyOp} MutationOp
 */

export class MutationQueue {
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
