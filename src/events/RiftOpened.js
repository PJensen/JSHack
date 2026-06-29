import { EcsEvent } from "../lib/ecs-js/index.js";

export class RiftOpened extends EcsEvent {
  constructor(payload = {}) {
    super();
    this.riftId = String(payload.riftId || "");
    this.portalId = Number(payload.portalId || 0) | 0;
    this.seed = Number(payload.seed || 0) >>> 0;
    this.levels = Math.max(0, Number(payload.levels || 0) | 0);
    this.originDepth = Math.max(0, Number(payload.originDepth || 0) | 0);
    this.originX = Number(payload.originX || 0) | 0;
    this.originY = Number(payload.originY || 0) | 0;
    this.x = Number(payload.x || 0) | 0;
    this.y = Number(payload.y || 0) | 0;
    Object.freeze(this);
  }
}
