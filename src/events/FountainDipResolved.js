import { EcsEvent } from "../lib/ecs-js/index.js";

export class FountainDipResolved extends EcsEvent {
  constructor(payload = {}) {
    super();
    this.actor = Number(payload.actor || 0) | 0;
    this.targetId = Number(payload.targetId || 0) | 0;
    this.itemId = Number(payload.itemId || 0) | 0;
    this.effect = String(payload.effect || "nothing");
    this.itemName = String(payload.itemName || "the item");
    this.spawnedName = payload.spawnedName ? String(payload.spawnedName) : null;
    this.stacks = Math.max(0, Number(payload.stacks || 0) | 0);
    this.ruined = payload.ruined === true;
    Object.freeze(this);
  }
}
