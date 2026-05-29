import { Faction } from "../components/Faction.js";
import { Flying } from "../components/Flying.js";
import { Position } from "../components/Position.js";
import { Vitality } from "../components/Vitality.js";
import { getLivingEntityAt } from "./tileQueryCache.js";
import { classifyActorTargetAction, isProtectedSocialTarget } from "./offenseClassifier.js";
import { areFactionsHostile } from "./factionHostility.js";

function isCardinal(dx, dy) {
  return Number.isInteger(dx) && Number.isInteger(dy) && Math.abs(dx) + Math.abs(dy) === 1;
}

export function isProtectedNonHostileTarget(world, actorId, targetId) {
  return isProtectedSocialTarget(world, actorId, targetId);
}

export function classifyAttackDirection(world, spec = {}) {
  const actorId = Number(spec.actorId || 0) | 0;
  const dx = Number(spec.dx || 0) | 0;
  const dy = Number(spec.dy || 0) | 0;
  if (!(actorId > 0) || !isCardinal(dx, dy)) {
    return Object.freeze({ ok: false, reason: "invalid_direction", targetId: 0, requiresConfirm: false });
  }

  const pos = world.get(actorId, Position);
  if (!pos) return Object.freeze({ ok: false, reason: "no_position", targetId: 0, requiresConfirm: false });

  const targetX = (pos.x | 0) + dx;
  const targetY = (pos.y | 0) + dy;
  const targetId = getLivingEntityAt(world, targetX, targetY) | 0;
  if (!(targetId > 0) || targetId === actorId) {
    return Object.freeze({ ok: false, reason: "no_target", targetId: 0, targetX, targetY, requiresConfirm: false });
  }

  const vit = world.get(targetId, Vitality);
  if (!vit || (vit.hp | 0) <= 0) {
    return Object.freeze({ ok: false, reason: "no_living_target", targetId, targetX, targetY, requiresConfirm: false });
  }

  if (world.has(targetId, Flying) && !world.has(actorId, Flying)) {
    return Object.freeze({ ok: false, reason: "target_flying", targetId, targetX, targetY, requiresConfirm: false });
  }

  const protectedNonHostile = isProtectedNonHostileTarget(world, actorId, targetId);
  const actorFaction = String(world.get(actorId, Faction)?.key || "");
  const targetFaction = String(world.get(targetId, Faction)?.key || "");
  const hostile = protectedNonHostile ? false : areFactionsHostile(actorFaction, targetFaction);
  const offense = classifyActorTargetAction(world, {
    actorId,
    targetId,
    actionKind: "melee_attack",
  });

  return Object.freeze({
    ok: true,
    reason: "target",
    targetId,
    targetX,
    targetY,
    hostile,
    protectedNonHostile,
    offense,
    requiresConfirm: offense.requiresConfirm,
    message: offense.message,
  });
}
