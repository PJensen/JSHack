import { AggroState, AGGRO_LEVELS, SEARCH_TURNS_HUNTING_GRACE } from "../components/AggroState.js";
import { TreasureDisturbed } from "../../events/TreasureDisturbed.js";
import { Faction } from "../components/Faction.js";
import { GuardedTreasure } from "../components/GuardedTreasure.js";
import { Position } from "../components/Position.js";
import { TreasureGuardian } from "../components/TreasureGuardian.js";
import { tryWakeActor } from "./sleep.js";

export function bindGuardianToTreasure(world, guardianId, treasureId, opts = {}) {
  if (!(guardianId > 0) || !(treasureId > 0)) return false;
  const gpos = world.get(guardianId, Position);
  const radius = Math.max(0, Number(opts.radius || 6) | 0);
  const role = String(opts.role || "guardian");
  const peacefulUntilDisturbed = opts.peacefulUntilDisturbed !== false;
  const guard = {
    treasureId,
    homeX: Number.isFinite(opts.homeX) ? (Number(opts.homeX) | 0) : ((gpos?.x | 0) || 0),
    homeY: Number.isFinite(opts.homeY) ? (Number(opts.homeY) | 0) : ((gpos?.y | 0) || 0),
    radius,
    peacefulUntilDisturbed,
    disturbed: false,
    disturbedBy: 0,
    role,
  };
  if (world.has(guardianId, TreasureGuardian)) world.set(guardianId, TreasureGuardian, guard);
  else world.add(guardianId, TreasureGuardian, guard);

  const treasure = {
    guardianId,
    radius,
    disturbed: false,
    disturbedBy: 0,
    kind: String(opts.kind || "treasure"),
  };
  if (world.has(treasureId, GuardedTreasure)) world.set(treasureId, GuardedTreasure, treasure);
  else world.add(treasureId, GuardedTreasure, treasure);
  return true;
}

export function disturbGuardedTreasure(world, treasureId, actorId) {
  const treasure = world.get(treasureId, GuardedTreasure);
  if (!treasure) return false;
  const guardianId = Number(treasure.guardianId || 0) | 0;
  if (!(guardianId > 0) || !world.isAlive(guardianId)) return false;

  world.set(treasureId, GuardedTreasure, {
    ...treasure,
    disturbed: true,
    disturbedBy: actorId,
  });

  const guard = world.get(guardianId, TreasureGuardian);
  if (guard) {
    world.set(guardianId, TreasureGuardian, {
      ...guard,
      treasureId,
      disturbed: true,
      disturbedBy: actorId,
    });
  }

  if (world.has(guardianId, Faction)) world.set(guardianId, Faction, { key: "enemy" });
  else world.add(guardianId, Faction, { key: "enemy" });

  const actorPos = world.get(actorId, Position);
  const lastKnownX = actorPos ? (actorPos.x | 0) : (world.get(treasureId, Position)?.x | 0) || 0;
  const lastKnownY = actorPos ? (actorPos.y | 0) : (world.get(treasureId, Position)?.y | 0) || 0;
  const aggro = {
    ...(world.get(guardianId, AggroState) || {}),
    alertLevel: AGGRO_LEVELS.hunting,
    targetId: actorId,
    targetReason: "guarded_treasure",
    highestThreatId: actorId,
    lastKnownX,
    lastKnownY,
    searchTurnsLeft: SEARCH_TURNS_HUNTING_GRACE,
  };
  if (world.has(guardianId, AggroState)) world.set(guardianId, AggroState, aggro);
  else world.add(guardianId, AggroState, aggro);

  tryWakeActor(world, guardianId, {
    reason: "guarded_treasure",
    intensity: Number.MAX_SAFE_INTEGER,
    source: actorId,
  });

  world.emit(new TreasureDisturbed({
    actor: actorId,
    treasureId,
    guardianId,
    reason: "pickup",
  }));
  return true;
}
