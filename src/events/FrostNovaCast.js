import { EcsEvent } from "../lib/ecs-js/index.js";

function point(payload, key) {
  const value = payload?.[key] || {};
  const x = Number(value.x);
  const y = Number(value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`FrostNovaCast.${key} must have finite x/y`);
  }
  return { x, y };
}

function frozenEntry(entry) {
  const id = Number(entry?.id || 0) | 0;
  const x = Number(entry?.x);
  const y = Number(entry?.y);
  if (!(id > 0) || !Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error("FrostNovaCast.frozen entries must include id and finite x/y");
  }
  return Object.freeze({ id, x, y });
}

export class FrostNovaCast extends EcsEvent {
  constructor(payload = {}) {
    super();

    const actor = Number(payload.actor || 0) | 0;
    if (!(actor > 0)) throw new Error("FrostNovaCast.actor must be a positive entity id");

    this.actor = actor;
    this.origin = point(payload, "origin");
    this.radius = Math.max(1, Number(payload.radius || 2) | 0);
    this.frozen = Object.freeze((Array.isArray(payload.frozen) ? payload.frozen : []).map(frozenEntry));

    Object.freeze(this);
  }
}
