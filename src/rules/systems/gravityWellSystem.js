// src/rules/systems/gravityWellSystem.js
// Each tick, gravity_well hazards pull nearby hostiles 1 tile toward center.
// Runs in the effects phase, just before hazardSystem (which deals the damage).

import { HazardArea } from "../components/HazardArea.js";
import { Faction } from "../components/Faction.js";
import { Position } from "../components/Position.js";
import { Vitality } from "../components/Vitality.js";
import { isWalkable } from "../environment/dungeon/tileMap.js";
import { areFactionsHostile } from "../utils/factionHostility.js";

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function gravityWellSystem(world) {
  for (const [hazardId, hpos, hazard] of world.query(Position, HazardArea)) {
    if (hazard.kind !== "gravity_well") continue;
    const cx = hpos.x | 0;
    const cy = hpos.y | 0;
    const radius = hazard.radius | 0;
    const srcFaction = world.get(hazard.sourceId, Faction)?.key || "";

    for (const [eid, epos] of world.query(Position, Vitality)) {
      if (eid === hazardId || eid === hazard.sourceId) continue;
      const ex = epos.x | 0;
      const ey = epos.y | 0;
      const dx = Math.abs(ex - cx);
      const dy = Math.abs(ey - cy);
      if (Math.max(dx, dy) > radius || (dx === 0 && dy === 0)) continue;

      // Only pull hostiles
      const eFaction = world.get(eid, Faction)?.key || "";
      if (srcFaction && eFaction && !areFactionsHostile(srcFaction, eFaction)) continue;

      // Step 1 tile toward center (cardinal bias: prioritize larger axis)
      const sx = Math.sign(cx - ex);
      const sy = Math.sign(cy - ey);
      const nx = ex + sx;
      const ny = ey + sy;

      if (isWalkable(nx, ny)) {
        epos.x = nx;
        epos.y = ny;
        try {
          world.emit?.("proc:gravityWell:pull", {
            hazardId,
            entityId: eid,
            from: { x: ex, y: ey },
            to: { x: nx, y: ny },
            center: { x: cx, y: cy },
          });
        } catch { /* */ }
      }
    }
  }
}
