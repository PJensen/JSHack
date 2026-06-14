import { EcsEvent } from "../lib/ecs-js/index.js";

function point(payload, key) {
  const value = payload?.[key] || {};
  const x = Number(value.x);
  const y = Number(value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`VoidHoleCast.${key} must have finite x/y`);
  }
  return { x: x | 0, y: y | 0 };
}

export class VoidHoleCast extends EcsEvent {
  constructor(payload = {}) {
    super();

    const actor = Number(payload.actor || 0) | 0;
    if (!(actor > 0)) throw new Error("VoidHoleCast.actor must be a positive entity id");

    this.actor = actor;
    this.from = point(payload, "from");
    this.origin = point(payload, "origin");
    this.radius = Math.max(1, Number(payload.radius || 3) | 0);
    this.affected = Array.isArray(payload.affected)
      ? payload.affected.map((entry) => Object.freeze({
        id: Number(entry?.id || 0) | 0,
        from: point(entry || {}, "from"),
        to: point(entry || {}, "to"),
      })).filter((entry) => entry.id > 0)
      : [];

    Object.freeze(this);
  }
}
