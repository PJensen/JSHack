import { EcsEvent } from "../lib/ecs-js/index.js";

function point(payload, key) {
  const value = payload?.[key] || {};
  const x = Number(value.x);
  const y = Number(value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`FearSpellCast.${key} must have finite x/y`);
  }
  return { x, y };
}

export class FearSpellCast extends EcsEvent {
  constructor(payload = {}) {
    super();

    const actor = Number(payload.actor || 0) | 0;
    if (!(actor > 0)) throw new Error("FearSpellCast.actor must be a positive entity id");

    this.actor = actor;
    this.targetId = Number(payload.targetId || 0) | 0;
    this.from = point(payload, "from");
    this.at = point(payload, "at");
    this.fizzle = !!payload.fizzle;
    this.missed = !!payload.missed;
    this.missTo = payload.missTo ? point(payload, "missTo") : null;
    this.projectileDelay = Math.max(0, Number(payload.projectileDelay || 0));
    this.duration = Math.max(0, Number(payload.duration || 0) | 0);
    this.reason = String(payload.reason || "");

    Object.freeze(this);
  }
}
