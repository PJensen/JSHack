import { EcsEvent } from "../lib/ecs-js/index.js";

export class LockpickPrompted extends EcsEvent {
  constructor(payload = {}) {
    super();

    const actor = Number(payload.actor || 0) | 0;
    const targetId = Number(payload.targetId || 0) | 0;
    if (!(actor > 0)) throw new Error("LockpickPrompted.actor must be a positive entity id");
    if (!(targetId > 0)) throw new Error("LockpickPrompted.targetId must be a positive entity id");

    this.actor = actor;
    this.targetId = targetId;
    this.pins = Math.max(2, Math.min(9, Number(payload.pins || 4) | 0));
    this.difficulty = String(payload.difficulty || "easy");

    Object.freeze(this);
  }
}
