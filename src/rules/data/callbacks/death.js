// rules/data/callbacks/death.js
// Death callback context and shared factory functions for monster death hooks.

import { spawnPlasmaCloud } from "../../utils/spawnPlasmaCloud.js";
import { CentipedeSegment } from "../../components/CentipedeSegment.js";
import { Brain } from "../../components/Brain.js";
import { AggroState, AGGRO_LEVELS, SEARCH_TURNS_HUNTING_GRACE } from "../../components/AggroState.js";
import { SoundEmitter } from "../../components/SoundEmitter.js";
import { Wounds } from "../../components/Wounds.js";
import { Position } from "../../components/Position.js";
import { spawnHazard } from "../../utils/hazardSpawn.js";
import { emitSafe } from "../../utils/emitSafe.js";

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
    emitSafe(this.world, eventName, payload);
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

/**
 * Spawn a small floor-fire puff at death location.
 * Intended for low-yield deaths like burning vermin.
 *
 * @param {{
 *   turnsLeft?: number,
 *   tickDamage?: number,
 *   radius?: number,
 *   identity?: string,
 *   name?: string,
 }} [params]
 */
export function spawnFirePuffOnDeath(params = {}) {
  const cfg = (params && typeof params === "object") ? { ...params } : {};
  return (ctx) => {
    if (!ctx?.pos) return;
    const x = ctx.pos.x | 0;
    const y = ctx.pos.y | 0;
    spawnHazard(ctx.world, {
      x,
      y,
      kind: "fire",
      medium: "floor",
      turnsLeft: Math.max(1, Number(cfg.turnsLeft ?? 2) | 0),
      radius: Math.max(0, Number(cfg.radius ?? 0) | 0),
      tickDamage: Math.max(0, Number(cfg.tickDamage ?? 1) | 0),
      damageType: "fire",
      cause: "monster:death:fire_puff",
      sourceId: ctx.deadId | 0,
      sourceKind: String(ctx.identity || "flaming_bat"),
      identity: String(cfg.identity || "flame_puff"),
      name: String(cfg.name || "Flame Puff"),
    });
    emitSafe(ctx.world, "monster:death:fire_puff", {
      id: ctx.deadId | 0,
      at: { x, y },
    });
  };
}

// ── Gas spore explosion ──────────────────────────────────────────────

/**
 * Spawn a large fire explosion at death location — gas spore detonation.
 * Creates a multi-tile fire hazard and emits a dedicated event for VFX.
 *
 * @param {{
 *   turnsLeft?: number,
 *   tickDamage?: number,
 *   radius?: number,
 * }} [params]
 */
export function gasSporeExplodeOnDeath(params = {}) {
  const cfg = (params && typeof params === "object") ? { ...params } : {};
  return (ctx) => {
    if (!ctx?.pos) return;
    const x = ctx.pos.x | 0;
    const y = ctx.pos.y | 0;
    const turnsLeft = Math.max(1, Number(cfg.turnsLeft ?? 3) | 0);
    const radius = Math.max(0, Number(cfg.radius ?? 2) | 0);
    const tickDamage = Math.max(0, Number(cfg.tickDamage ?? 6) | 0);
    const sourceId = ctx.deadId | 0;
    spawnHazard(ctx.world, {
      x,
      y,
      kind: "gas",
      medium: "air",
      turnsLeft,
      radius,
      tickDamage,
      damageType: "poison",
      cause: "monster:death:gas_spore",
      sourceId,
      sourceKind: "gas_spore",
      identity: "explosive_gas",
      name: "Explosive Gas",
      meta: {
        distanceMetric: "euclidean",
      },
    });
    emitSafe(ctx.world, "monster:death:gas_spore", {
      id: sourceId,
      at: { x, y },
      radius,
    });
  };
}

// ── Centipede split-on-death ──────────────────────────────────────────

/**
 * Promote a body segment to a new centipede head.
 * Adds Brain + AggroState (hunting, pointed at killer) + SoundEmitter + Wounds.
 * Re-indexes the remaining tail-side chain.
 */
function promoteToHead(world, newHeadId, killerId) {
  const seg = world.get(newHeadId, CentipedeSegment);
  if (!seg) return;

  // Update segment metadata
  seg.index = 0;
  seg.headId = 0;  // self is head
  seg.prevId = 0;  // no predecessor

  // New chain ID
  const newChainId = ((world.step * 0x9e3779b9) ^ (newHeadId * 0x517cc1b7)) >>> 0;
  seg.chainId = newChainId;

  // Re-index tail-side chain
  let cursor = seg.nextId;
  let idx = 1;
  while (cursor && world.isAlive(cursor)) {
    const cSeg = world.get(cursor, CentipedeSegment);
    if (!cSeg) break;
    cSeg.headId = newHeadId;
    cSeg.index = idx++;
    cSeg.chainId = newChainId;
    cursor = cSeg.nextId;
  }

  // Grant full AI components to the new head
  if (!world.has(newHeadId, Brain)) {
    try { world.add(newHeadId, Brain, {
      learnedSpellIds: [], itemKnowledgeIdentities: [],
      seenTiles: new Uint8Array(), intelligence: 2, visionRange: 8,
    }); } catch { /* already present */ }
  }

  // Start hunting, pointed toward the killer
  let lkx = 0, lky = 0;
  if (killerId && world.isAlive(killerId)) {
    const kp = world.get(killerId, Position);
    if (kp) { lkx = kp.x | 0; lky = kp.y | 0; }
  }
  if (!world.has(newHeadId, AggroState)) {
    try { world.add(newHeadId, AggroState, {
      alertLevel: AGGRO_LEVELS.hunting,
      lastKnownX: lkx, lastKnownY: lky,
      searchTurnsLeft: SEARCH_TURNS_HUNTING_GRACE,
      retreating: false, patrolDx: 0, patrolDy: 0,
    }); } catch { /* already present */ }
  }

  if (!world.has(newHeadId, SoundEmitter)) {
    try { world.add(newHeadId, SoundEmitter, { ambient: 30, lastActionNoise: 0 }); } catch {}
  }
  if (!world.has(newHeadId, Wounds)) {
    try { world.add(newHeadId, Wounds, { list: [] }); } catch {}
  }

  emitSafe(world, "centipede:split", { newHeadId });
}

/**
 * When any centipede segment dies, unlink it and promote the tail-side
 * to an independent centipede.
 */
export function centipedeSplitOnDeath() {
  return (ctx) => {
    const world = ctx.world;
    const deadId = ctx.deadId;
    const seg = world.get(deadId, CentipedeSegment);
    if (!seg) return;

    const prevId = seg.prevId;
    const nextId = seg.nextId;

    // Unlink dead segment from its neighbors
    if (prevId && world.isAlive(prevId)) {
      const prevSeg = world.get(prevId, CentipedeSegment);
      if (prevSeg) prevSeg.nextId = 0;
    }
    if (nextId && world.isAlive(nextId)) {
      const nextSeg = world.get(nextId, CentipedeSegment);
      if (nextSeg) nextSeg.prevId = 0;
    }

    // Promote tail-side to a new independent centipede
    if (nextId && world.isAlive(nextId)) {
      promoteToHead(world, nextId, ctx.killer);
    }
  };
}
