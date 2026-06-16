import { EcsEvent } from "../lib/ecs-js/index.js";

export class BedSleepRequested extends EcsEvent {
  constructor(payload = {}) {
    super();
    this.actor = Number(payload.actor || 0) | 0;
    this.targetId = Number(payload.targetId || 0) | 0;
    this.turns = Math.max(0, Number(payload.turns || 0) | 0);
    Object.freeze(this);
  }
}
