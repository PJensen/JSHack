import { EcsEvent } from "../lib/ecs-js/index.js";

function normalizeRoom(room) {
  const rec = (room && typeof room === "object") ? room : {};
  return {
    x: Number(rec.x || 0) | 0,
    y: Number(rec.y || 0) | 0,
    w: Number(rec.w || 0) | 0,
    h: Number(rec.h || 0) | 0,
  };
}

/**
 * Typed receipt for a deity-authored challenge becoming active.
 */
export class DeityChallengeStarted extends EcsEvent {
  constructor(payload = {}) {
    super();

    const challengeId = Number(payload.challengeId || 0) | 0;
    if (!(challengeId > 0)) throw new Error("DeityChallengeStarted.challengeId must be positive");

    this.deityId = String(payload.deityId || "");
    this.playerId = Number(payload.playerId || 0) | 0;
    this.challengeId = challengeId;
    this.kind = String(payload.kind || "monster_ambush");
    this.reason = String(payload.reason || "");
    this.room = Object.freeze(normalizeRoom(payload.room));
    this.spawnedIds = Object.freeze(
      Array.isArray(payload.spawnedIds)
        ? payload.spawnedIds.map((id) => Number(id || 0) | 0).filter((id) => id > 0)
        : [],
    );

    Object.freeze(this);
  }
}
