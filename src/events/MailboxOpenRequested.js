import { EcsEvent } from "../lib/ecs-js/index.js";

export class MailboxOpenRequested extends EcsEvent {
  constructor(payload = {}) {
    super();
    this.actor = Number(payload.actor || 0) | 0;
    this.targetId = Number(payload.targetId || 0) | 0;
    Object.freeze(this);
  }
}
