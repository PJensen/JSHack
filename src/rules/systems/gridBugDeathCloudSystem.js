import { NamedIdentity } from "../components/NamedIdentity.js";
import { Position } from "../components/Position.js";
import { spawnPlasmaCloud } from "./plasmaCloudSystem.js";

const INSTALLED_KEY = Symbol.for("jshack:gridBug:plasmaCloudDeath:installed");
const SEEN_KEY = Symbol.for("jshack:gridBug:plasmaCloudDeath:seenPerStep");

function ensureSeenState(world) {
  const rec = world[SEEN_KEY];
  if (rec && typeof rec === "object" && rec.ids instanceof Set) return rec;
  const created = { step: -1, ids: new Set() };
  world[SEEN_KEY] = created;
  return created;
}

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function installGridBugDeathClouds(world) {
  if (!world || world[INSTALLED_KEY]) return;
  world[INSTALLED_KEY] = true;
  ensureSeenState(world);

  world.on("died", ({ id }) => {
    const deadId = Number(id || 0) | 0;
    if (!(deadId > 0)) return;

    const ident = world.get(deadId, NamedIdentity);
    if (!ident || ident.identity !== "grid_bug") return;
    const pos = world.get(deadId, Position);
    if (!pos) return;

    const seen = ensureSeenState(world);
    const step = world.step | 0;
    if (seen.step !== step) {
      seen.step = step;
      seen.ids.clear();
    }
    if (seen.ids.has(deadId)) return;
    seen.ids.add(deadId);

    spawnPlasmaCloud(world, {
      x: pos.x,
      y: pos.y,
      turnsLeft: 3,
      radius: 1,
      damage: 2,
      sourceId: deadId,
      sourceKind: "grid_bug",
    });
  });
}
