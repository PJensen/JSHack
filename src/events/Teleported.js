import { EcsEvent } from "../lib/ecs-js/index.js";

function point(value) {
  const x = Number(value?.x);
  const y = Number(value?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return Object.freeze({ x: x | 0, y: y | 0 });
}

export class Teleported extends EcsEvent {
  constructor(payload = {}) {
    super();
    this.id = Number(payload.id || 0) | 0;
    this.from = point(payload.from);
    this.to = point(payload.to);
    this.source = String(payload.source || "");
    Object.freeze(this);
  }
}
