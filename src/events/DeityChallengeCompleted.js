import { EcsEvent } from "../lib/ecs-js/index.js";
import { normalizeGridPoint } from "../shared/math/point.js";

/**
 * Typed receipt for a deity-authored challenge being defeated and rewarded.
 */
export class DeityChallengeCompleted extends EcsEvent {
  constructor(payload = {}) {
    super();

    const challengeId = Number(payload.challengeId || 0) | 0;
    if (!(challengeId > 0)) throw new Error("DeityChallengeCompleted.challengeId must be positive");

    this.deityId = String(payload.deityId || "");
    this.playerId = Number(payload.playerId || 0) | 0;
    this.challengeId = challengeId;
    this.rewardId = Number(payload.rewardId || 0) | 0;
    this.rewardKind = String(payload.rewardKind || "");
    this.amount = Number(payload.amount || 0) | 0;
    this.at = normalizeGridPoint(payload.at);

    Object.freeze(this);
  }
}
