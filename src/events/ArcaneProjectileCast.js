import { EcsEvent } from "../lib/ecs-js/index.js";

function point(payload, key) {
  const value = payload?.[key] || {};
  const x = Number(value.x);
  const y = Number(value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`Arcane projectile event ${key} must have finite x/y`);
  }
  return { x, y };
}

class ArcaneProjectileCastBase extends EcsEvent {
  constructor(payload = {}) {
    super();

    const actor = Number(payload.actor || 0) | 0;
    const targetId = Number(payload.targetId || 0) | 0;
    if (!(actor > 0)) throw new Error("Arcane projectile event actor must be a positive entity id");

    this.actor = actor;
    this.targetId = targetId;
    this.from = point(payload, "from");
    this.at = point(payload, "at");
    this.hit = !!payload.hit;
    this.missed = !!payload.missed;
    this.fizzle = !!payload.fizzle;
    this.missTo = payload.missTo ? point(payload, "missTo") : null;
    this.projectileDelay = Math.max(0, Number(payload.projectileDelay || 0));

  }
}

export class MagicMissileCast extends ArcaneProjectileCastBase {
  constructor(payload = {}) {
    super(payload);
    Object.freeze(this);
  }
}

export class ArcaneBarrageCast extends ArcaneProjectileCastBase {
  constructor(payload = {}) {
    super(payload);
    this.lanes = Math.max(1, Number(payload.lanes || 3) | 0);
    Object.freeze(this);
  }
}
