import { EcsEvent } from "../lib/ecs-js/index.js";

export class FountainDried extends EcsEvent {
  constructor(payload = {}) {
    super();
    this.actor = Number(payload.actor || 0) | 0;
    this.targetId = Number(payload.targetId || 0) | 0;
    this.chargesRemaining = 0;
    this.cooldownTurns = Math.max(1, Number(payload.cooldownTurns || 1) | 0);
    this.dryUntilStep = Number(payload.dryUntilStep ?? -1) | 0;
    Object.freeze(this);
  }
}
