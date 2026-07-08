import { EcsEvent } from "../lib/ecs-js/index.js";

export class RiftClosed extends EcsEvent {
  constructor(payload = {}) {
    super();
    this.actor = Number(payload.actor || 0) | 0;
    this.riftId = String(payload.riftId || "");
    this.portalId = Number(payload.portalId || 0) | 0;
    this.reason = String(payload.reason || "");
    this.x = Number.isFinite(Number(payload.x)) ? (Number(payload.x) | 0) : null;
    this.y = Number.isFinite(Number(payload.y)) ? (Number(payload.y) | 0) : null;
    Object.freeze(this);
  }
}
