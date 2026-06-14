import { EcsEvent } from "../lib/ecs-js/index.js";

export class TrapDodgePrompted extends EcsEvent {
  constructor(payload = {}) {
    super();

    this.promptId = String(payload.promptId || "");
    this.victimId = Number(payload.victimId || 0) | 0;
    this.trapId = Number(payload.trapId || 0) | 0;
    this.type = String(payload.type || "trap");
    this.durationMs = Math.max(250, Number(payload.durationMs || 0) | 0);
    this.angleDeg = ((Number(payload.angleDeg || 0) % 360) + 360) % 360;
    this.evade = Number(payload.evade || 0);

    Object.freeze(this);
  }
}
