import { EcsEvent } from "../lib/ecs-js/index.js";

export class RiftExited extends EcsEvent {
  constructor(payload = {}) {
    super();
    this.actor = Number(payload.actor || 0) | 0;
    this.riftId = String(payload.riftId || "");
    this.originDepth = Math.max(0, Number(payload.originDepth || 0) | 0);
    this.originX = Number(payload.originX || 0) | 0;
    this.originY = Number(payload.originY || 0) | 0;
    Object.freeze(this);
  }
}
