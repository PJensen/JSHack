import { EcsEvent } from "../lib/ecs-js/index.js";

export class FountainPurified extends EcsEvent {
  constructor(payload = {}) {
    super();
    this.actor = Number(payload.actor || 0) | 0;
    this.targetId = Number(payload.targetId || 0) | 0;
    this.itemId = Number(payload.itemId || 0) | 0;
    this.itemName = String(payload.itemName || "holy water");
    Object.freeze(this);
  }
}
