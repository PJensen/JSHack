import { GrowthStage } from "../components/GrowthStage.js";
import { HarvestNode } from "../components/HarvestNode.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { DungeonState } from "../components/DungeonState.js";
import { Changed } from "../../lib/ecs-js/index.js";
import { createTurnSchedule } from "../utils/turnSchedule.js";

const STANDALONE_GROWTH_WAKEUPS = Symbol.for("jshack:plantGrowth:standaloneWakeups");
const STANDALONE_GROWTH_TRACKED = Symbol.for("jshack:plantGrowth:standaloneTracked");
const STANDALONE_GROWTH_LAST_DEPTH = Symbol.for("jshack:plantGrowth:lastDepth");

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
function getWakeups(world) {
  if (!world[STANDALONE_GROWTH_WAKEUPS]) {
    world[STANDALONE_GROWTH_WAKEUPS] = createTurnSchedule({ maxLevel: 10 });
  }
  return world[STANDALONE_GROWTH_WAKEUPS];
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
function getTracked(world) {
  if (!world[STANDALONE_GROWTH_TRACKED]) world[STANDALONE_GROWTH_TRACKED] = new Set();
  return world[STANDALONE_GROWTH_TRACKED];
}

/**
 * @param {any} gs
 */
function isStandaloneCandidate(gs) {
  return !!gs
    && (Number(gs.growInterval || 0) | 0) > 0
    && (Number(gs.currentStage || 0) | 0) < (Number(gs.maxStage || 0) | 0);
}

/**
 * @param {any} gs
 */
function nextDueDelta(gs) {
  const interval = Math.max(1, Number(gs?.growInterval || 1) | 0);
  const countdown = Math.max(0, Number(gs?.growCountdown || 0) | 0);
  return countdown > 0 ? countdown : interval;
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} id
 * @param {any} gs
 */
function scheduleStandalone(world, id, gs) {
  const wakeups = getWakeups(world);
  const tracked = getTracked(world);
  const dueTurn = (world.step | 0) + nextDueDelta(gs);
  wakeups.schedule(String(id | 0), dueTurn, id | 0);
  tracked.add(id | 0);
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} id
 */
function cancelStandalone(world, id) {
  const wakeups = getWakeups(world);
  const tracked = getTracked(world);
  wakeups.cancel(String(id | 0));
  tracked.delete(id | 0);
}

/**
 * Seed/resync standalone plant wakeups when entering depth 0.
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
function seedStandaloneWakeups(world) {
  const wakeups = getWakeups(world);
  const tracked = getTracked(world);
  wakeups.clear();
  tracked.clear();
  for (const [id, gs] of world.query(GrowthStage)) {
    if (world.has(id, HarvestNode)) continue;
    if (!isStandaloneCandidate(gs)) continue;
    scheduleStandalone(world, id, gs);
  }
}

/**
 * Keep wakeups aligned to changed GrowthStage rows.
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
function syncChangedStandaloneWakeups(world) {
  for (const [id, gs] of world.query(GrowthStage, Changed(GrowthStage))) {
    if (world.has(id, HarvestNode)) {
      cancelStandalone(world, id);
      continue;
    }
    if (!isStandaloneCandidate(gs)) {
      cancelStandalone(world, id);
      continue;
    }
    scheduleStandalone(world, id, gs);
  }
}

/**
 * Keep growCountdown visible as remaining turns until next stage wakeup.
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
function syncStandaloneCountdownView(world) {
  const wakeups = getWakeups(world);
  const tracked = getTracked(world);
  const now = world.step | 0;
  for (const id of tracked) {
    if (!world.isAlive(id)) {
      cancelStandalone(world, id);
      continue;
    }
    const gs = world.get(id, GrowthStage);
    if (!gs || world.has(id, HarvestNode) || !isStandaloneCandidate(gs)) {
      cancelStandalone(world, id);
      continue;
    }
    const due = wakeups.getDueTurn(String(id));
    const remaining = due == null ? 0 : Math.max(0, (due | 0) - now);
    if ((gs.growCountdown | 0) !== remaining) {
      world.mutate(id, GrowthStage, (r) => { r.growCountdown = remaining; });
    }
  }
}

/**
 * Advance due standalone plants by one growth stage and reschedule.
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
function processStandaloneWakeups(world) {
  const wakeups = getWakeups(world);
  const now = world.step | 0;
  wakeups.drainDue(now, (_key, value) => {
    const id = Number(value || 0) | 0;
    if (!(id > 0) || !world.isAlive(id) || world.has(id, HarvestNode)) {
      cancelStandalone(world, id);
      return;
    }
    const gs = world.get(id, GrowthStage);
    if (!isStandaloneCandidate(gs)) {
      cancelStandalone(world, id);
      return;
    }

    const newStage = Math.min((gs.currentStage | 0) + 1, gs.maxStage | 0);
    const mature = newStage >= (gs.maxStage | 0);
    world.mutate(id, GrowthStage, (r) => {
      r.currentStage = newStage;
      r.growCountdown = mature ? 0 : Math.max(1, r.growInterval | 0);
    });

    const identities = gs.stageIdentities;
    const newIdentity = Array.isArray(identities) ? identities[newStage] : null;
    if (newIdentity) {
      const ni = world.get(id, NamedIdentity);
      if (ni && ni.identity !== newIdentity) {
        world.set(id, NamedIdentity, { ...ni, identity: newIdentity });
      }
    }

    if (mature) {
      cancelStandalone(world, id);
      return;
    }
    const next = world.get(id, GrowthStage);
    if (isStandaloneCandidate(next)) scheduleStandalone(world, id, next);
  });
}

/**
 * Advance plant growth stages on the overworld (depth 0).
 *
 * Two modes:
 *   1. Crop mode (growInterval === 0): stage derived from HarvestNode regrow
 *      countdown progress. Stage resets to 0 on harvest.
 *   2. Standalone mode (growInterval > 0): simple turn-counter advances one
 *      stage per interval until maxStage is reached.
 *
 * When stage changes, NamedIdentity.identity is updated to drive the palette
 * glyph swap (seedling → herb → mature emoji).
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
export function plantGrowthSystem(world) {
  let depth = 1;
  for (const [, ds] of world.query(DungeonState)) {
    depth = ds.currentDepth ?? 1;
    break;
  }
  const lastDepth = Number(world[STANDALONE_GROWTH_LAST_DEPTH] ?? 1);
  world[STANDALONE_GROWTH_LAST_DEPTH] = depth;
  if (depth !== 0) return;
  if (lastDepth !== 0) seedStandaloneWakeups(world);
  syncChangedStandaloneWakeups(world);
  processStandaloneWakeups(world);
  syncStandaloneCountdownView(world);

  for (const [id, gs, hn] of world.query(GrowthStage, HarvestNode)) {
    const identities = gs.stageIdentities;
    if (!Array.isArray(identities)) continue;

    let newStage = gs.currentStage;
    // Crop mode: derive stage from HarvestNode countdown
    if (hn.ready) {
      newStage = gs.maxStage;
    } else if (hn.needsPlanting) {
      newStage = 0;
    } else {
      const total = hn.regrowTurns || 1;
      const remaining = hn.regrowCountdown || 0;
      const progress = 1 - remaining / total;  // 0..1
      newStage = Math.min(
        gs.maxStage - 1,
        Math.floor(progress * gs.maxStage)
      );
    }

    if (newStage === gs.currentStage) continue;

    world.mutate(id, GrowthStage, (r) => {
      r.currentStage = newStage;
    });

    // Update identity to swap palette glyph
    const newIdentity = identities[newStage];
    if (newIdentity) {
      const ni = world.get(id, NamedIdentity);
      if (ni && ni.identity !== newIdentity) {
        world.set(id, NamedIdentity, { ...ni, identity: newIdentity });
      }
    }
  }
}
