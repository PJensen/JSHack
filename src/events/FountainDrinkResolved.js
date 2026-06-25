import { EcsEvent } from "../lib/ecs-js/index.js";

export class FountainDrinkResolved extends EcsEvent {
  constructor(payload = {}) {
    super();
    this.actor = Number(payload.actor || 0) | 0;
    this.targetId = Number(payload.targetId || 0) | 0;
    this.effect = String(payload.effect || "nothing");
    this.amount = Number(payload.amount || 0) | 0;
    this.buff = String(payload.buff || "");
    this.turns = Math.max(0, Number(payload.turns || 0) | 0);
    this.cursedName = payload.cursedName ? String(payload.cursedName) : null;
    this.spawnedName = payload.spawnedName ? String(payload.spawnedName) : null;
    this.wishedItem = payload.wishedItem ? String(payload.wishedItem) : null;
    this.tilesFlooded = Math.max(0, Number(payload.tilesFlooded || 0) | 0);
    this.from = payload.from || null;
    this.to = payload.to || null;
    Object.freeze(this);
  }
}
