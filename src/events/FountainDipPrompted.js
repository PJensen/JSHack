import { EcsEvent } from "../lib/ecs-js/index.js";

export class FountainDipPrompted extends EcsEvent {
  constructor(payload = {}) {
    super();
    this.actor = Number(payload.actor || 0) | 0;
    this.targetId = Number(payload.targetId || 0) | 0;
    this.items = Object.freeze(Array.isArray(payload.items) ? payload.items.slice() : []);
    Object.freeze(this);
  }
}
