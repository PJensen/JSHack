import { EcsEvent } from "../lib/ecs-js/index.js";

export class TrapDodgeUiEnabled extends EcsEvent {
  constructor(payload = {}) {
    super();
    this.enabled = payload.enabled !== false;
    Object.freeze(this);
  }
}
