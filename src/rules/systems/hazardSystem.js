import { HazardArea } from "../components/HazardArea.js";
import { PlasmaCloud } from "../components/PlasmaCloud.js";
import { Position } from "../components/Position.js";
import { Vitality } from "../components/Vitality.js";
import { dealDamage } from "../utils/dealDamage.js";

const DEFAULT_TURNS = 3;
const DEFAULT_RADIUS = 1;
const DEFAULT_TICK_DAMAGE = 0;

function clampInt(value, fallback, min = 0) {
  const n = Number.isFinite(value) ? (value | 0) : fallback;
  return Math.max(min, n | 0);
}

/**
 * Generic hazard resolver for persistent AoE entities.
 * `medium` is metadata only for now (`air` vs `floor`).
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function hazardSystem(world) {
  for (const [hazardId, pos, hazard] of world.query(Position, HazardArea)) {
    if (!pos || !hazard) continue;

    const kind = String(hazard.kind || "generic").toLowerCase() || "generic";
    const medium = String(hazard.medium || "air").toLowerCase() === "floor" ? "floor" : "air";
    const radius = clampInt(hazard.radius, DEFAULT_RADIUS, 0);
    const tickDamage = clampInt(hazard.tickDamage, DEFAULT_TICK_DAMAGE, 0);
    const turnsBefore = clampInt(hazard.turnsLeft, DEFAULT_TURNS, 0);
    const damageType = String(hazard.damageType || "generic").toLowerCase() || "generic";
    const cause = String(hazard.cause || `${kind}_hazard`);
    const sourceId = clampInt(hazard.sourceId, 0, 0);
    const sourceKind = typeof hazard.sourceKind === "string" ? hazard.sourceKind : "";

    /** @type {number[]} */
    const affectedIds = [];

    if (tickDamage > 0) {
      for (const [id, tpos, vit] of world.query(Position, Vitality)) {
        if (!tpos || !vit) continue;
        if (id === hazardId) continue;
        if ((vit.hp | 0) <= 0) continue;

        const dx = Math.abs((tpos.x | 0) - (pos.x | 0));
        const dy = Math.abs((tpos.y | 0) - (pos.y | 0));
        if (Math.max(dx, dy) > radius) continue;

        const hit = dealDamage(world, {
          target: id,
          amount: tickDamage,
          type: damageType,
          source: hazardId,
          at: { x: tpos.x, y: tpos.y },
          cause,
        });
        if (hit.applied) affectedIds.push(id);
      }
    }

    hazard.turnsLeft = turnsBefore - 1;
    const turnsLeft = hazard.turnsLeft | 0;

    // Keep legacy PlasmaCloud component in sync while migrating call sites.
    const legacyPlasma = world.get(hazardId, PlasmaCloud);
    if (legacyPlasma) {
      legacyPlasma.turnsLeft = turnsLeft;
      legacyPlasma.radius = radius;
      legacyPlasma.damage = tickDamage;
      legacyPlasma.sourceId = sourceId;
      legacyPlasma.sourceKind = sourceKind;
    }

    try {
      world.emit?.("hazard:pulse", {
        hazardId,
        kind,
        medium,
        at: { x: pos.x, y: pos.y },
        radius,
        tickDamage,
        damageType,
        cause,
        turnsLeft,
        affectedIds,
        sourceId,
        sourceKind,
      });
    } catch { /* */ }

    // Plasma compatibility bridge for existing listeners/tests.
    if (kind === "plasma") {
      try {
        world.emit?.("plasmaCloud:pulse", {
          cloudId: hazardId,
          at: { x: pos.x, y: pos.y },
          radius,
          damage: tickDamage,
          turnsLeft,
          affectedIds,
          sourceId,
          sourceKind,
          medium,
        });
      } catch { /* */ }
    }

    if (turnsLeft <= 0) {
      try {
        world.emit?.("hazard:expired", {
          hazardId,
          kind,
          medium,
          at: { x: pos.x, y: pos.y },
          radius,
          damageType,
          cause,
          sourceId,
          sourceKind,
        });
      } catch { /* */ }

      if (kind === "plasma") {
        try {
          world.emit?.("plasmaCloud:expired", {
            cloudId: hazardId,
            at: { x: pos.x, y: pos.y },
            radius,
            sourceId,
            sourceKind,
            medium,
          });
        } catch { /* */ }
      }
      world.destroy(hazardId);
    }
  }
}
