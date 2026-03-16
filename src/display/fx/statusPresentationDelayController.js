const INSTALLED_KEY = Symbol.for("jshack:display:statusPresentationDelay:installed");

/**
 * Delay presentation-only status tags until matching projectile FX reaches impact.
 * Keeps rules timing deterministic while making visual ordering line up with the hit.
 */
export function createStatusPresentationDelayController({ world, getFxTime }) {
  /** @type {Map<string, number>} */
  const revealAtByKey = new Map();

  function makeKey(id, tag) {
    return `${Number(id || 0) | 0}:${String(tag || "").toLowerCase()}`;
  }

  function setRevealDelay(id, tag, delaySec) {
    const delay = Number(delaySec || 0);
    if (!(delay > 0)) return;
    const now = typeof getFxTime === "function" ? Number(getFxTime() || 0) : 0;
    const key = makeKey(id, tag);
    const revealAt = now + delay;
    const existing = Number(revealAtByKey.get(key) || 0);
    if (revealAt > existing) revealAtByKey.set(key, revealAt);
  }

  function isHidden(id, tag, fxTime) {
    const revealAt = Number(revealAtByKey.get(makeKey(id, tag)) || 0);
    return revealAt > Number(fxTime || 0);
  }

  function pruneExpired(fxTime) {
    const now = Number(fxTime || 0);
    for (const [key, revealAt] of revealAtByKey.entries()) {
      if (!(Number(revealAt) > now)) revealAtByKey.delete(key);
    }
  }

  function installListeners() {
    if (!world || world[INSTALLED_KEY]) return;
    world[INSTALLED_KEY] = true;

    world.on("spell:frost", ({ targetId, projectileDelay, fizzle }) => {
      if (fizzle) return;
      const id = Number(targetId || 0) | 0;
      if (!(id > 0)) return;
      setRevealDelay(id, "frozen", projectileDelay);
    });
  }

  /**
   * Returns the original view when no filtering is needed; otherwise returns a
   * shallow copy with only affected entity tag arrays rewritten.
   */
  function filterWorldView(worldView, fxTime) {
    pruneExpired(fxTime);
    const entities = Array.isArray(worldView?.entities) ? worldView.entities : null;
    if (!entities || entities.length === 0 || revealAtByKey.size === 0) return worldView;

    let nextEntities = null;
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const tags = Array.isArray(entity?.tags) ? entity.tags : null;
      if (!tags || tags.length === 0) continue;
      let filteredTags = null;
      for (let t = 0; t < tags.length; t++) {
        const tag = tags[t];
        if (!isHidden(entity.id, tag, fxTime)) continue;
        if (!filteredTags) filteredTags = tags.filter((candidate) => !isHidden(entity.id, candidate, fxTime));
        break;
      }
      if (!filteredTags) continue;
      if (!nextEntities) nextEntities = entities.slice();
      nextEntities[i] = { ...entity, tags: filteredTags };
    }

    if (!nextEntities) return worldView;
    return { ...worldView, entities: nextEntities };
  }

  return {
    installListeners,
    filterWorldView,
  };
}
