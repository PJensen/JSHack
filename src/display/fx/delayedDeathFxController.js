// src/display/fx/delayedDeathFxController.js
// Display-only suppression for corpse/loot spawned by delayed-impact kills.

import { Position } from "../../rules/components/Position.js";

const DELAYED_DEATH_FX_INSTALLED = Symbol.for("jshack:display:delayedDeathFx:installed");

function cellKey(x, y) {
  return `${x | 0},${y | 0}`;
}

/**
 * @param {{
 *   world: import('../../lib/ecs-js/index.js').World,
 *   getFxTime?: () => number,
 * }} deps
 */
export function createDelayedDeathFxController({ world, getFxTime }) {
  /** @type {Map<number, number>} */
  const delayedImpactUntilByTarget = new Map();
  /** @type {Map<string, { until:number, startedAt:number }>} */
  const delayedDeathCells = new Map();
  /** @type {Map<number, number>} */
  const hiddenItems = new Map();
  const now = () => Math.max(0, Number(getFxTime?.() || 0));

  function isItemHidden(id) {
    const itemId = Number(id || 0) | 0;
    if (!(itemId > 0)) return false;
    const until = Number(hiddenItems.get(itemId) || 0);
    return until > now();
  }

  function prune() {
    const t = now();
    for (const [targetId, until] of delayedImpactUntilByTarget) {
      if (!(until > t)) delayedImpactUntilByTarget.delete(targetId);
    }
    for (const [key, rec] of delayedDeathCells) {
      if (!(Number(rec?.until || 0) > t)) delayedDeathCells.delete(key);
    }
    for (const [itemId, until] of hiddenItems) {
      if (!(until > t)) hiddenItems.delete(itemId);
    }
  }

  function installListeners() {
    if (world[DELAYED_DEATH_FX_INSTALLED]) return;
    world[DELAYED_DEATH_FX_INSTALLED] = true;

    world.on("damaged", ({ target, projectileDelay }) => {
      const targetId = Number(target || 0) | 0;
      const delay = Number(projectileDelay || 0);
      if (!(targetId > 0) || !(delay > 0)) return;
      const until = now() + delay;
      const prev = Number(delayedImpactUntilByTarget.get(targetId) || 0);
      if (until > prev) delayedImpactUntilByTarget.set(targetId, until);
    });

    world.on("died", ({ id }) => {
      const targetId = Number(id || 0) | 0;
      if (!(targetId > 0)) return;
      const until = Number(delayedImpactUntilByTarget.get(targetId) || 0);
      if (!(until > now())) return;
      const pos = world.get(targetId, Position);
      if (!pos) return;
      delayedDeathCells.set(cellKey(pos.x, pos.y), { until, startedAt: now() });
    });

    world.on("item:dropped", ({ itemId, at }) => {
      const droppedId = Number(itemId || 0) | 0;
      if (!(droppedId > 0) || !at) return;
      const x = Number(at.x);
      const y = Number(at.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const rec = delayedDeathCells.get(cellKey(x, y));
      if (!rec) return;
      if (!(Number(rec.until || 0) > now())) return;
      hiddenItems.set(droppedId, Number(rec.until));
    });
  }

  function tick(_dt) {
    void _dt;
    prune();
  }

  return {
    installListeners,
    isItemHidden,
    tick,
  };
}
