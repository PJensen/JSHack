import { EcsEvent } from "../lib/ecs-js/index.js";

function point(value) {
  const x = Number(value?.x);
  const y = Number(value?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return Object.freeze({ x: x | 0, y: y | 0 });
}

export class PuffSpawned extends EcsEvent {
  constructor(payload = {}) {
    super();
    this.at = point(payload.at);
    this.source = String(payload.source || "");
    this.kind = String(payload.kind || "smoke");
    Object.freeze(this);
  }
}
