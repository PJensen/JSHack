// rules/data/callbacks/death.js
// Death callback context and shared factory functions for monster death hooks.

import { spawnPlasmaCloud } from "../../utils/spawnPlasmaCloud.js";

/**
 * Context passed to monster death hook callbacks.
 * Provides emit(), cancel(), and hazard helper methods.
 */
export class DeathCallbackContext {
  /**
   * @param {any} world
   * @param {{
   *   deadId: number,
   *   killer: number,
   *   cause: string,
   *   identity: string,
   *   pos: { x:number, y:number } | null,
   * }} frame
   */
  constructor(world, frame) {
    this.world = world;
    this._frame = frame;
    this._cancelled = false;
    this._cancelReason = null;
  }

  get deadId() { return this._frame.deadId | 0; }
  get killer() { return this._frame.killer | 0; }
  get cause() { return String(this._frame.cause || ""); }
  get identity() { return String(this._frame.identity || ""); }
  get pos() { return this._frame.pos || null; }

  get cancelled() { return this._cancelled; }
  get cancelReason() { return this._cancelReason; }

  /**
   * @param {unknown} reason
   */
  cancel(reason) {
    this._cancelled = true;
    this._cancelReason = typeof reason === "string"
      ? { code: reason, message: reason }
      : reason || { code: "CANCELLED", message: "Cancelled" };
  }

  /** @param {string} eventName @param {any} payload */
  emit(eventName, payload) {
    try { this.world.emit?.(eventName, payload); } catch {}
  }

  /**
   * @param {{ turnsLeft?:number, radius?:number, damage?:number, sourceId?:number, sourceKind?:string }} [params]
   */
  spawnPlasmaCloud(params = {}) {
    const pos = this.pos;
    if (!pos) return 0;
    const sourceKind = String(params.sourceKind || this.identity || "");
    const sourceId = Number.isFinite(params.sourceId)
      ? (params.sourceId | 0)
      : (this.deadId | 0);
    return spawnPlasmaCloud(this.world, {
      x: pos.x | 0,
      y: pos.y | 0,
      turnsLeft: params.turnsLeft,
      radius: params.radius,
      damage: params.damage,
      sourceId,
      sourceKind,
    });
  }
}

/**
 * Spawn a plasma cloud centered on the dead monster's tile.
 * @param {{ turnsLeft?:number, radius?:number, damage?:number, sourceKind?:string }} [params]
 */
export function spawnPlasmaCloudOnDeath(params = {}) {
  const config = (params && typeof params === "object") ? { ...params } : {};
  return (ctx) => {
    if (!ctx || typeof ctx.spawnPlasmaCloud !== "function") return;
    ctx.spawnPlasmaCloud(config);
  };
}
