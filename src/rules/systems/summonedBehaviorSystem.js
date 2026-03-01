// src/rules/systems/summonedBehaviorSystem.js
// Simple aggressive AI for summoned creatures (e.g. summoned skeletons).
// Chases the nearest hostile enemy and attacks when adjacent.

import { Position } from '../components/Position.js';
import { Faction } from '../components/Faction.js';
import { Vitality } from '../components/Vitality.js';
import { Speed } from '../components/Speed.js';
import { MoveIntent } from '../components/Intents/MoveIntent.js';
import { MeleeAttackIntent } from '../components/Intents/MeleeAttackIntent.js';
import { areFactionsHostile } from '../utils/factionHostility.js';
import { statusStrength } from '../utils/statusFacade.js';
import { forEachInRadius } from '../utils/spatialIndex.js';

const ACTIVE_RADIUS = 20;

/** @param {any} world */
export function summonedBehaviorSystem(world) {
  for (const [id, fac, pos, vit] of world.query(Faction, Position, Vitality)) {
    if (!fac || fac.key !== 'summoned') continue;
    if (!vit || (vit.hp | 0) <= 0) continue;

    // Speed gate
    const spd = world.get(id, Speed);
    let actEvery = (spd && spd.actEvery > 1) ? spd.actEvery : 1;
    const frostStacks = Math.min(3, statusStrength(world, id, "frozen"));
    if (frostStacks > 0) actEvery = actEvery * (1 + frostStacks);
    if (actEvery > 1 && ((world.step + id) % actEvery) !== 0) continue;

    if (world.has(id, MoveIntent) || world.has(id, MeleeAttackIntent)) continue;

    // Find nearest hostile enemy
    let bestTarget = 0;
    let bestDist = Infinity;
    let bestPos = null;

    forEachInRadius(world, pos.x, pos.y, ACTIVE_RADIUS, (eid, epos) => {
      if (eid === id) return;
      const eFac = world.get(eid, Faction);
      if (!eFac || !areFactionsHostile(fac.key, eFac.key)) return;
      const eVit = world.get(eid, Vitality);
      if (!eVit || (eVit.hp | 0) <= 0) return;
      const dist = Math.abs((epos.x | 0) - (pos.x | 0)) + Math.abs((epos.y | 0) - (pos.y | 0));
      if (dist < bestDist) {
        bestTarget = eid;
        bestDist = dist;
        bestPos = { x: epos.x | 0, y: epos.y | 0 };
      }
    });

    if (!bestTarget || !bestPos) continue;

    // Adjacent: attack
    if (bestDist === 1) {
      try { world.add(id, MeleeAttackIntent, { sourceId: id, targetId: bestTarget }); } catch {}
      continue;
    }

    // Otherwise move toward target
    const dx = bestPos.x - (pos.x | 0);
    const dy = bestPos.y - (pos.y | 0);
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    let mx = 0, my = 0;
    if (ax >= ay) { mx = Math.sign(dx); } else { my = Math.sign(dy); }
    if ((mx | my) !== 0) {
      try { world.add(id, MoveIntent, { dx: mx, dy: my }); } catch {}
    }
  }
}
