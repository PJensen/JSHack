// src/display/fx/delayedDeathFxController.js
// Display-only suppression for corpse/loot spawned by delayed-impact kills.

const DELAYED_DEATH_FX_INSTALLED = Symbol.for("jshack:display:delayedDeathFx:installed");

function cellKey(x, y) {
  return `${x | 0},${y | 0}`;
}

/**
 * @param {{
 *   world: import('../../lib/ecs-js/index.js').World,
 *   getFxTime?: () => number,
 *   getPosition?: (id: number) => ({x:number,y:number}|null),
 * }} deps
 */
export function createDelayedDeathFxController({ world, getFxTime, getPosition }) {
  /** @type {Map<number, number>} */
  const delayedImpactUntilByTarget = new Map();
  /** @type {Map<number, number>} */
  const delayedDeathUntilByActor = new Map();
  /** @type {Map<string, { until:number, startedAt:number }>} */
  const delayedDeathCells = new Map();
  /** @type {Map<number, number>} */
  const hiddenItems = new Map();
  /** @type {Map<number, any>} */
  const entitySnapshots = new Map();
  /** @type {Map<number, { until:number, entity:any }>} */
  const ghostEntities = new Map();
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
    for (const [actorId, until] of delayedDeathUntilByActor) {
      if (!(until > t)) delayedDeathUntilByActor.delete(actorId);
    }
    for (const [key, rec] of delayedDeathCells) {
      if (!(Number(rec?.until || 0) > t)) delayedDeathCells.delete(key);
    }
    for (const [itemId, until] of hiddenItems) {
      if (!(until > t)) hiddenItems.delete(itemId);
    }
    for (const [id, rec] of ghostEntities) {
      if (!(Number(rec?.until || 0) > t)) ghostEntities.delete(id);
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
      delayedDeathUntilByActor.set(targetId, until);
      const pos = getPosition ? getPosition(targetId) : null;
      if (!pos) return;
      delayedDeathCells.set(cellKey(pos.x, pos.y), { until, startedAt: now() });
      const snap = entitySnapshots.get(targetId);
      if (snap) {
        ghostEntities.set(targetId, {
          until,
          entity: {
            ...snap,
            pos: { x: snap.pos.x, y: snap.pos.y },
            tags: Array.isArray(snap.tags) ? snap.tags.slice() : [],
          },
        });
      }
    });

    world.on("item:dropped", ({ itemId, at, actor, source, origin }) => {
      const droppedId = Number(itemId || 0) | 0;
      if (!(droppedId > 0)) return;

      let until = 0;

      if (String(source || "") === "death") {
        const actorId = Number(actor || 0) | 0;
        if (actorId > 0) {
          until = Math.max(until, Number(delayedDeathUntilByActor.get(actorId) || 0));
        }
      }

      if (origin && Number.isFinite(Number(origin.x)) && Number.isFinite(Number(origin.y))) {
        const rec = delayedDeathCells.get(cellKey(Number(origin.x), Number(origin.y)));
        if (rec) until = Math.max(until, Number(rec.until || 0));
      }

      if (at && Number.isFinite(Number(at.x)) && Number.isFinite(Number(at.y))) {
        const rec = delayedDeathCells.get(cellKey(Number(at.x), Number(at.y)));
        if (rec) until = Math.max(until, Number(rec.until || 0));
      }

      if (!(until > now())) return;
      hiddenItems.set(droppedId, until);
    });
  }

  function tick(_dt) {
    void _dt;
    prune();
  }

  function syncWorldView(worldView) {
    const entities = Array.isArray(worldView?.entities) ? worldView.entities : [];
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (!(Number(entity?.id || 0) > 0)) continue;
      entitySnapshots.set(entity.id, {
        ...entity,
        pos: { x: entity.pos.x, y: entity.pos.y },
        tags: Array.isArray(entity.tags) ? entity.tags.slice() : [],
      });
    }
  }

  function getRenderableEntities(entities) {
    prune();
    const live = Array.isArray(entities) ? entities : [];
    if (ghostEntities.size === 0) return live;
    const out = live.slice();
    const liveIds = new Set();
    for (let i = 0; i < live.length; i++) {
      const id = Number(live[i]?.id || 0) | 0;
      if (id > 0) liveIds.add(id);
    }
    for (const [id, rec] of ghostEntities) {
      if (liveIds.has(id)) continue;
      out.push(rec.entity);
    }
    return out;
  }

  return {
    getRenderableEntities,
    installListeners,
    isItemHidden,
    syncWorldView,
    tick,
  };
}
