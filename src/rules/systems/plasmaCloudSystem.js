import { NamedIdentity } from "../components/NamedIdentity.js";
import { PlasmaCloud } from "../components/PlasmaCloud.js";
import { Position } from "../components/Position.js";
import { Vitality } from "../components/Vitality.js";
import { applyTypedDamage } from "../utils/typedDamage.js";

const DEFAULT_TURNS = 3;
const DEFAULT_RADIUS = 1;
const DEFAULT_DAMAGE = 2;

function clampInt(value, fallback, min = 0) {
  const n = Number.isFinite(value) ? (value | 0) : fallback;
  return Math.max(min, n | 0);
}

/**
 * Reusable hazard spawner.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {{ x:number, y:number, turnsLeft?:number, radius?:number, damage?:number, sourceId?:number, sourceKind?:string }} params
 */
export function spawnPlasmaCloud(world, params) {
  if (!world || !params) return 0;
  const x = clampInt(params.x, 0);
  const y = clampInt(params.y, 0);
  const turnsLeft = clampInt(params.turnsLeft, DEFAULT_TURNS, 1);
  const radius = clampInt(params.radius, DEFAULT_RADIUS, 0);
  const damage = clampInt(params.damage, DEFAULT_DAMAGE, 0);
  const sourceId = clampInt(params.sourceId, 0, 0);
  const sourceKind = typeof params.sourceKind === "string" ? params.sourceKind : "";

  const cloudId = world.create();
  world.add(cloudId, Position, { x, y });
  world.add(cloudId, PlasmaCloud, { turnsLeft, radius, damage, sourceId, sourceKind });
  try { world.add(cloudId, NamedIdentity, { name: "Plasma Cloud", identity: "plasma_cloud" }); } catch { /* */ }

  try {
    world.emit?.("plasmaCloud:spawned", {
      cloudId,
      at: { x, y },
      turnsLeft,
      radius,
      damage,
      sourceId,
      sourceKind,
    });
  } catch { /* */ }

  return cloudId;
}

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function plasmaCloudSystem(world) {
  for (const [cloudId, pos, cloud] of world.query(Position, PlasmaCloud)) {
    if (!pos || !cloud) continue;

    const radius = clampInt(cloud.radius, DEFAULT_RADIUS, 0);
    const damage = clampInt(cloud.damage, DEFAULT_DAMAGE, 0);
    const turnsBefore = clampInt(cloud.turnsLeft, DEFAULT_TURNS, 0);
    const sourceId = clampInt(cloud.sourceId, 0, 0);
    const sourceKind = typeof cloud.sourceKind === "string" ? cloud.sourceKind : "";

    /** @type {number[]} */
    const affectedIds = [];

    if (damage > 0) {
      for (const [id, tpos, vit] of world.query(Position, Vitality)) {
        if (!tpos || !vit) continue;
        if (id === cloudId) continue;
        if ((vit.hp | 0) <= 0) continue;

        const dx = Math.abs((tpos.x | 0) - (pos.x | 0));
        const dy = Math.abs((tpos.y | 0) - (pos.y | 0));
        if (Math.max(dx, dy) > radius) continue;

        const hit = applyTypedDamage(world, id, {
          amount: damage,
          type: "electric",
          sourceId: cloudId,
          at: { x: tpos.x, y: tpos.y },
          cause: "plasma_cloud",
          kind: "plasma_cloud",
          immuneText: "plasma",
          resistText: "grounded",
        });
        if (hit.applied) affectedIds.push(id);
      }
    }

    cloud.turnsLeft = turnsBefore - 1;
    const turnsLeft = cloud.turnsLeft | 0;
    try {
      world.emit?.("plasmaCloud:pulse", {
        cloudId,
        at: { x: pos.x, y: pos.y },
        radius,
        damage,
        turnsLeft,
        affectedIds,
        sourceId,
        sourceKind,
      });
    } catch { /* */ }

    if (turnsLeft <= 0) {
      try {
        world.emit?.("plasmaCloud:expired", {
          cloudId,
          at: { x: pos.x, y: pos.y },
          radius,
          sourceId,
          sourceKind,
        });
      } catch { /* */ }
      world.destroy(cloudId);
    }
  }
}
