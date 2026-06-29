import { EcsEvent } from "../lib/ecs-js/index.js";

export class UrnInteractionResolved extends EcsEvent {
  constructor(payload = {}) {
    super();
    this.actor = Number(payload.actor || 0) | 0;
    this.targetId = Number(payload.targetId || 0) | 0;
    this.outcome = String(payload.outcome || "empty-ashes");
    this.spawnedName = payload.spawnedName ? String(payload.spawnedName) : null;
    this.damage = Math.max(0, Number(payload.damage || 0) | 0);
    this.lootCount = Math.max(0, Number(payload.lootCount || 0) | 0);
    this.at = payload.at || null;
    Object.freeze(this);
  }
}
