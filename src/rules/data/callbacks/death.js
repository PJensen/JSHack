// rules/data/callbacks/death.js
// Death callback context and shared factory functions for monster death hooks.

import { spawnPlasmaCloud } from "../../utils/spawnPlasmaCloud.js";
import { CentipedeSegment } from "../../components/CentipedeSegment.js";
import { Brain } from "../../components/Brain.js";
import { AggroState, AGGRO_LEVELS, SEARCH_TURNS_HUNTING_GRACE } from "../../components/AggroState.js";
import { SoundEmitter } from "../../components/SoundEmitter.js";
import { Wounds } from "../../components/Wounds.js";
import { Position } from "../../components/Position.js";

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
    try { this.world.emit?.(eventName, payload); } catch (e) { console.debug('[death] emit ' + eventName + ' failed:', e); }
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

  try { world.emit("centipede:split", { newHeadId }); } catch {}
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
