import { EcsEvent } from "../lib/ecs-js/index.js";

export class LockpickResolved extends EcsEvent {
  constructor(payload = {}) {
    super();

    const actor = Number(payload.actor || 0) | 0;
    const targetId = Number(payload.targetId || 0) | 0;
    if (!(actor > 0)) throw new Error("LockpickResolved.actor must be a positive entity id");
    if (!(targetId > 0)) throw new Error("LockpickResolved.targetId must be a positive entity id");

    this.actor = actor;
    this.targetId = targetId;
    this.success = !!payload.success;
    this.reason = String(payload.reason || (this.success ? "unlocked" : "failed"));
    this.consumed = Math.max(0, Number(payload.consumed || 0) | 0);

    Object.freeze(this);
  }
}
