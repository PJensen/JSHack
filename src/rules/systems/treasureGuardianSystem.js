import { defineExtension } from "../../lib/ecs-js/index.js";
import { GuardedTreasure } from "../components/GuardedTreasure.js";
import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Position } from "../components/Position.js";
import { TreasureGuardian } from "../components/TreasureGuardian.js";
import { isChestIdentity } from "../../shared/chests.js";
import { bindGuardianToTreasure, disturbGuardedTreasure } from "../utils/treasureGuards.js";

function chebyshev(a, b) {
  return Math.max(Math.abs((a.x | 0) - (b.x | 0)), Math.abs((a.y | 0) - (b.y | 0)));
}

function isTreasureCandidate(world, id) {
  if (world.has(id, GuardedTreasure)) return true;
  const ident = world.get(id, NamedIdentity);
  if (ident && isChestIdentity(String(ident.identity || ""))) return true;
  const info = world.get(id, ItemInfo);
  if (!info) return false;
  if (String(info.type || "") === "currency") return true;
  return Number(info.value || 0) > 0;
}

function findNearestTreasure(world, guardId, guard, pos) {
  let bestId = 0;
  let bestDist = Infinity;
  const radius = Math.max(0, Number(guard.radius || 0) | 0);

  for (const [id, tpos] of world.query(Position)) {
    if (id === guardId) continue;
    if (!isTreasureCandidate(world, id)) continue;
    const dist = chebyshev(pos, tpos);
    if (dist > radius || dist >= bestDist) continue;
    bestId = id;
    bestDist = dist;
  }
  return bestId;
}

export const treasureGuardianListenerExtension = defineExtension(
  "jshack:rules:treasureGuardian:listeners",
  (world) => {
    world.on("item:pickup", ({ actor, itemId, sourceContainerId }) => {
      const actorId = Number(actor || 0) | 0;
      const pickedId = Number(itemId || 0) | 0;
      const containerId = Number(sourceContainerId || 0) | 0;
      if (containerId > 0 && world.has(containerId, GuardedTreasure)) {
        disturbGuardedTreasure(world, containerId, actorId);
        return;
      }
      if (pickedId > 0 && world.has(pickedId, GuardedTreasure)) {
        disturbGuardedTreasure(world, pickedId, actorId);
      }
    });
  },
);

export function treasureGuardianSystem(world) {
  for (const [id, guard, pos] of world.query(TreasureGuardian, Position)) {
    if (guard.disturbed) continue;
    if ((Number(guard.treasureId || 0) | 0) > 0) continue;
    const treasureId = findNearestTreasure(world, id, guard, pos);
    if (!(treasureId > 0)) continue;
    bindGuardianToTreasure(world, id, treasureId, {
      radius: guard.radius,
      role: guard.role,
      peacefulUntilDisturbed: guard.peacefulUntilDisturbed,
      kind: world.has(treasureId, Inventory) ? "container" : "treasure",
    });
  }
}
