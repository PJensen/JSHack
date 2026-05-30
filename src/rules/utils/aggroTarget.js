import { Faction } from "../components/Faction.js";
import { Player } from "../components/Player.js";
import { Position } from "../components/Position.js";

export function classifyAggroTarget(world, targetId) {
  const id = Number(targetId || 0) | 0;
  if (!(id > 0)) return "none";
  if (world.has(id, Player)) return "player";
  const factionKey = String(world.get(id, Faction)?.key || "").trim().toLowerCase();
  if (factionKey === "pet" || factionKey === "summoned" || factionKey === "stone_taunter") return "ally";
  return "npc";
}

export function setAggroTarget(world, sourceId, aggro, targetId, reason = "selected") {
  const nextTargetId = Number(targetId || 0) | 0;
  const prevTargetId = Number(aggro?.targetId || 0) | 0;
  const nextReason = String(reason || "selected");
  const prevReason = String(aggro?.targetReason || "");
  if (!aggro) return;
  if (prevTargetId === nextTargetId && prevReason === nextReason) return;

  aggro.targetId = nextTargetId;
  aggro.targetReason = nextTargetId > 0 ? nextReason : "";
  if (!(nextTargetId > 0)) return;

  const sourcePos = world.get(sourceId, Position);
  const targetPos = world.get(nextTargetId, Position);
  world.emit?.("aggro:targetChanged", {
    sourceId,
    targetId: nextTargetId,
    previousTargetId: prevTargetId,
    reason: nextReason,
    sourceFaction: String(world.get(sourceId, Faction)?.key || ""),
    targetFaction: String(world.get(nextTargetId, Faction)?.key || ""),
    targetKind: classifyAggroTarget(world, nextTargetId),
    sourcePos: sourcePos ? { x: sourcePos.x | 0, y: sourcePos.y | 0 } : null,
    targetPos: targetPos ? { x: targetPos.x | 0, y: targetPos.y | 0 } : null,
  });
}
