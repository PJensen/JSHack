import { HazardArea } from "../components/HazardArea.js";
import { PlasmaCloud } from "../components/PlasmaCloud.js";
import { spawnHazard } from "./hazardSpawn.js";
import { clampInt } from "./numberCoerce.js";

const DEFAULT_TURNS = 3;
const DEFAULT_RADIUS = 1;
const DEFAULT_DAMAGE = 2;

/**
 * Compatibility wrapper that spawns a plasma hazard via generic hazard spawning.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {{ x:number, y:number, turnsLeft?:number, radius?:number, damage?:number, sourceId?:number, sourceKind?:string }} params
 */
export function spawnPlasmaCloud(world, params) {
  if (!world || !params) return 0;

  const x = Number.isFinite(params.x) ? (params.x | 0) : 0;
  const y = Number.isFinite(params.y) ? (params.y | 0) : 0;
  const turnsLeft = clampInt(params.turnsLeft, DEFAULT_TURNS, 1);
  const radius = clampInt(params.radius, DEFAULT_RADIUS, 0);
  const damage = clampInt(params.damage, DEFAULT_DAMAGE, 0);
  const sourceId = clampInt(params.sourceId, 0, 0);
  const sourceKind = typeof params.sourceKind === "string" ? params.sourceKind : "";

  const cloudId = spawnHazard(world, {
    x,
    y,
    kind: "plasma",
    medium: "air",
    turnsLeft,
    radius,
    tickDamage: damage,
    damageType: "electric",
    cause: "plasma_cloud",
    sourceId,
    sourceKind,
    identity: "plasma_cloud",
    name: "Plasma Cloud",
  });
  if (!(cloudId > 0)) return 0;

  // Legacy component kept during migration so existing queries still work.
  const hz = world.get(cloudId, HazardArea);
  const rec = {
    turnsLeft: Number(hz?.turnsLeft || turnsLeft) | 0,
    radius: Number(hz?.radius || radius) | 0,
    damage: Number(hz?.tickDamage || damage) | 0,
    sourceId: Number(hz?.sourceId || sourceId) | 0,
    sourceKind: String(hz?.sourceKind || sourceKind),
  };
  try {
    if (world.has(cloudId, PlasmaCloud)) world.set(cloudId, PlasmaCloud, rec);
    else world.add(cloudId, PlasmaCloud, rec);
  } catch { /* */ }

  return cloudId;
}
