import { EcsEvent } from "../lib/ecs-js/index.js";

export class RiftClosed extends EcsEvent {
  constructor(payload = {}) {
    super();
    this.actor = Number(payload.actor || 0) | 0;
    this.riftId = String(payload.riftId || "");
    this.portalId = Number(payload.portalId || 0) | 0;
    this.reason = String(payload.reason || "");
    Object.freeze(this);
  }
}
