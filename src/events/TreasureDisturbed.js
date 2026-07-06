import { EcsEvent } from "../lib/ecs-js/index.js";

export class TreasureDisturbed extends EcsEvent {
  constructor(payload = {}) {
    super();
    this.actor = Number(payload.actor || 0) | 0;
    this.treasureId = Number(payload.treasureId || 0) | 0;
    this.guardianId = Number(payload.guardianId || 0) | 0;
    this.reason = String(payload.reason || "");
    Object.freeze(this);
  }
}
