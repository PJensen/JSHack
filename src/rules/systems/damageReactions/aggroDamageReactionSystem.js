import { AggroState, AGGRO_LEVELS, SEARCH_TURNS_ALERTED } from "../../components/AggroState.js";
import { DamageApplied } from "../../components/DamageApplied.js";
import { Position } from "../../components/Position.js";

export function aggroDamageReactionSystem(world) {
  for (const [, damage] of world.query(DamageApplied)) {
    if (!(damage.amount > 0)) continue;
    const target = Number(damage.target || 0) | 0;
    const source = Number(damage.source || 0) | 0;
    const aggro = world.get(target, AggroState);
    if (!aggro) continue;
    if (aggro.alertLevel === AGGRO_LEVELS.hunting) continue;

    const srcPos = (source && world.isAlive(source)) ? world.get(source, Position) : null;
    if (srcPos) {
      aggro.lastKnownX = srcPos.x | 0;
      aggro.lastKnownY = srcPos.y | 0;
    } else if (damage.at) {
      aggro.lastKnownX = damage.at.x | 0;
      aggro.lastKnownY = damage.at.y | 0;
    }

    aggro.alertLevel = AGGRO_LEVELS.alerted;
    aggro.targetId = 0;
    aggro.searchTurnsLeft = SEARCH_TURNS_ALERTED;

    const tPos = world.get(target, Position);
    if (tPos) {
      world.emit("status", {
        id: target,
        kind: "alert",
        at: { x: tPos.x | 0, y: tPos.y | 0 },
      });
    }
  }
}
