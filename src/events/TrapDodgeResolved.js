import { EcsEvent } from "../lib/ecs-js/index.js";

export class TrapDodgeResolved extends EcsEvent {
  constructor(payload = {}) {
    super();

    this.promptId = String(payload.promptId || "");
    this.victimId = Number(payload.victimId || 0) | 0;
    this.trapId = Number(payload.trapId || 0) | 0;
    this.dodged = !!payload.dodged;

    Object.freeze(this);
  }
}
