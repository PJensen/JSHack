import { Faction } from "../components/Faction.js";
import { Flying } from "../components/Flying.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Position } from "../components/Position.js";
import { Vitality } from "../components/Vitality.js";
import { getLivingEntityAt } from "./tileQueryCache.js";
import { areFactionsHostile } from "./factionHostility.js";

const PROTECTED_NON_HOSTILE_FACTIONS = new Set(["shopkeeper", "townfolk", "neutral"]);

function isCardinal(dx, dy) {
  return Number.isInteger(dx) && Number.isInteger(dy) && Math.abs(dx) + Math.abs(dy) === 1;
}

function nameOf(world, id) {
  const ni = world.get(id, NamedIdentity);
  return String(ni?.name || ni?.identity || "that creature");
}

export function isProtectedNonHostileTarget(world, actorId, targetId) {
  const actorFaction = world.get(actorId, Faction)?.key || "";
  const targetFaction = world.get(targetId, Faction)?.key || "";
  const protectedTarget = PROTECTED_NON_HOSTILE_FACTIONS.has(String(targetFaction || "").trim().toLowerCase());
  if (!protectedTarget) return false;
  if (!actorFaction) return true;
  return !areFactionsHostile(actorFaction, targetFaction);
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

  const actorFaction = world.get(actorId, Faction)?.key || "";
  const targetFaction = world.get(targetId, Faction)?.key || "";
  const protectedNonHostile = isProtectedNonHostileTarget(world, actorId, targetId);
  const hostile = protectedNonHostile ? false : areFactionsHostile(actorFaction, targetFaction);
  const targetName = nameOf(world, targetId);

  return Object.freeze({
    ok: true,
    reason: "target",
    targetId,
    targetX,
    targetY,
    hostile,
    protectedNonHostile,
    requiresConfirm: protectedNonHostile,
    message: `Attack ${targetName}?`,
  });
}
