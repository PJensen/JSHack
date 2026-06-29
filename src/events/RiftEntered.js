import { EcsEvent } from "../lib/ecs-js/index.js";

export class RiftEntered extends EcsEvent {
  constructor(payload = {}) {
    super();
    this.actor = Number(payload.actor || 0) | 0;
    this.riftId = String(payload.riftId || "");
    this.level = Math.max(0, Number(payload.level || 0) | 0);
    this.levels = Math.max(0, Number(payload.levels || 0) | 0);
    this.seed = Number(payload.seed || 0) >>> 0;
    Object.freeze(this);
  }
}
