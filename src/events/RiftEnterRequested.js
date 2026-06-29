import { EcsEvent } from "../lib/ecs-js/index.js";

export class RiftEnterRequested extends EcsEvent {
  constructor(payload = {}) {
    super();
    this.actor = Number(payload.actor || 0) | 0;
    this.portalId = Number(payload.portalId || payload.targetId || 0) | 0;
    this.riftId = String(payload.riftId || "");
    Object.freeze(this);
  }
}
