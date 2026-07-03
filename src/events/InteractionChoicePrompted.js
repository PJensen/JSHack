import { EcsEvent } from "../lib/ecs-js/index.js";

export class InteractionChoicePrompted extends EcsEvent {
  constructor(payload = {}) {
    super();
    this.actor = Number(payload.actor || 0) | 0;
    this.targetId = Number(payload.targetId || 0) | 0;
    this.action = String(payload.action || "");
    this.options = Object.freeze((Array.isArray(payload.options) ? payload.options : []).map((option) => Object.freeze({
      mode: String(option?.mode || ""),
      label: String(option?.label || ""),
      disabled: option?.disabled === true,
    })));
    Object.freeze(this);
  }
}
