import { EcsEvent } from "../lib/ecs-js/index.js";

export class FountainRefilled extends EcsEvent {
  constructor(payload = {}) {
    super();
    this.targetId = Number(payload.targetId || 0) | 0;
    this.chargesRemaining = Math.max(1, Number(payload.chargesRemaining || 1) | 0);
    this.cooldownTurns = Math.max(1, Number(payload.cooldownTurns || 1) | 0);
    Object.freeze(this);
  }
}
