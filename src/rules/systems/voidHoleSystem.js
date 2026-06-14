import { VoidHole } from "../components/VoidHole.js";
import { Position } from "../components/Position.js";
import { Faction } from "../components/Faction.js";
import { Vitality } from "../components/Vitality.js";
import { Collider } from "../components/Collider.js";
import { Physiology } from "../components/Physiology.js";
import { isWalkable } from "../environment/dungeon/tileMap.js";
import { forEachInRadius } from "../utils/spatialIndex.js";
import { areFactionsHostile } from "../utils/factionHostility.js";
import { dealDamage } from "../utils/dealDamage.js";
import { buildSpellDamageSpec } from "../utils/spellDamage.js";
import { computeEnvelopeValue } from "../../shared/math/envelope.js";
import { VoidHoleCast } from "../../events/VoidHoleCast.js";

export function computeVoidHoleStrength(pulseIndex, durationTurns) {
  const duration = Math.max(1, Number(durationTurns || 4) | 0);
  const pulse = Math.max(1, Number(pulseIndex || 1) | 0);
  const elapsed = Math.min(duration - 1, pulse - 1);
  return computeEnvelopeValue(0.65, 1, 0.75, 1, Math.max(0, duration - 3), 1, elapsed);
}

function pointKey(x, y) {
  return `${x | 0},${y | 0}`;
}

function buildBlockedPoints(world, holeId) {
  const blocked = new Set();
  for (const [id, pos] of world.query(Position)) {
    if (id === holeId) continue;
    const col = world.get(id, Collider);
    const vit = world.get(id, Vitality);
    if ((col && col.solid) || (vit && (vit.hp | 0) > 0)) {
      blocked.add(pointKey(pos.x, pos.y));
    }
  }
  return blocked;
}

function tryPullOneStep(pos, cx, cy, blocked) {
  const x = pos.x | 0;
  const y = pos.y | 0;
  const sx = Math.sign((cx | 0) - x);
  const sy = Math.sign((cy | 0) - y);
  if (sx === 0 && sy === 0) return false;

  const candidates = [];
  if (sx !== 0 && sy !== 0) candidates.push({ x: x + sx, y: y + sy });
  if (Math.abs((cx | 0) - x) >= Math.abs((cy | 0) - y)) {
    if (sx !== 0) candidates.push({ x: x + sx, y });
    if (sy !== 0) candidates.push({ x, y: y + sy });
  } else {
    if (sy !== 0) candidates.push({ x, y: y + sy });
    if (sx !== 0) candidates.push({ x: x + sx, y });
  }

  for (const next of candidates) {
    const key = pointKey(next.x, next.y);
    if (!isWalkable(next.x, next.y) || blocked.has(key)) continue;
    blocked.delete(pointKey(x, y));
    pos.x = next.x;
    pos.y = next.y;
    blocked.add(key);
    return true;
  }
  return false;
}

function pullStepsForMass(world, id, strength, maxSteps) {
  const cap = Math.max(0, Number(maxSteps || 0) | 0);
  if (cap <= 0) return 0;
  const mass = Math.max(0, Number(world.get(id, Physiology)?.massKg || 80));
  const peak = strength >= 0.98;
  if (mass <= 30) return Math.min(cap, peak ? 2 : 1);
  if (mass <= 120) return Math.min(cap, strength >= 0.65 ? 1 : 0);
  if (mass <= 300) return peak ? Math.min(cap, 1) : 0;
  return 0;
}

function damageForDistance(hole, dist, collapsing) {
  let amount = Math.max(0, Number(hole.tickDamage || 0) | 0);
  if (dist <= 1) amount += 3;
  if (collapsing && dist <= 1) amount += 6;
  return amount;
}

function inwardImpactVector(pos, origin) {
  const dx = (origin.x | 0) - (pos.x | 0);
  const dy = (origin.y | 0) - (pos.y | 0);
  const len = Math.hypot(dx, dy);
  if (!(len > 0)) return undefined;
  return { dx: dx / len, dy: dy / len };
}

export function voidHoleSystem(world) {
  for (const [holeId, hole, origin] of world.query(VoidHole, Position)) {
    const sourceId = Number(hole.sourceId || 0) | 0;
    if (!(sourceId > 0) || !world.isAlive(sourceId)) continue;
    const sourceFaction = String(world.get(sourceId, Faction)?.key || "player");
    const radius = Math.max(1, Number(hole.radius || 3) | 0);
    const maxPullSteps = Math.max(0, Number(hole.pullSteps || 0) | 0);
    const durationTurns = Math.max(1, Number(hole.durationTurns || 4) | 0);
    const pulseIndex = Math.min(durationTurns, Math.max(1, Number(hole.ageTurns || 0) + 1));
    const strength = computeVoidHoleStrength(pulseIndex, durationTurns);
    const collapsing = pulseIndex >= durationTurns;
    const blocked = buildBlockedPoints(world, holeId);
    const affected = [];

    forEachInRadius(world, origin.x, origin.y, radius, (id, pos) => {
      if (id === holeId || id === sourceId) return;
      const fac = world.get(id, Faction);
      if (!fac || !areFactionsHostile(sourceFaction, fac.key)) return;
      const vit = world.get(id, Vitality);
      if (!vit || (vit.hp | 0) <= 0) return;
      const dx = (pos.x | 0) - (origin.x | 0);
      const dy = (pos.y | 0) - (origin.y | 0);
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      if (dist > radius) return;

      const before = { x: pos.x | 0, y: pos.y | 0 };
      blocked.delete(pointKey(before.x, before.y));
      const pullSteps = pullStepsForMass(world, id, strength, maxPullSteps);
      for (let step = 0; step < pullSteps; step++) {
        if (!tryPullOneStep(pos, origin.x, origin.y, blocked)) break;
      }
      blocked.add(pointKey(pos.x, pos.y));

      affected.push({ id, from: before, to: { x: pos.x | 0, y: pos.y | 0 } });
      dealDamage(world, buildSpellDamageSpec(world, sourceId, id, {
        spell: { id: "void_hole" },
        baseAmount: damageForDistance(hole, dist, collapsing),
        type: "shadow",
        cause: collapsing ? "spell:void_hole:collapse" : "spell:void_hole",
        at: { x: pos.x | 0, y: pos.y | 0 },
        impactVector: inwardImpactVector(pos, origin),
        salt: 0x501d ^ holeId ^ id ^ pulseIndex,
      }));
    });

    world.emit(new VoidHoleCast({
      actor: sourceId,
      holeId,
      from: { x: origin.x | 0, y: origin.y | 0 },
      origin: { x: origin.x | 0, y: origin.y | 0 },
      radius,
      pulseIndex,
      durationTurns,
      strength,
      collapsing,
      affected,
    }));
    hole.ageTurns = Math.min(durationTurns, Number(hole.ageTurns || 0) + 1);
  }
}
