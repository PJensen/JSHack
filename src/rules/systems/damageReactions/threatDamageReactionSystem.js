import { AggroState } from "../../components/AggroState.js";
import { DamageApplied } from "../../components/DamageApplied.js";
import { Faction } from "../../components/Faction.js";
import { Vitality } from "../../components/Vitality.js";
import { areFactionsHostile } from "../../utils/factionHostility.js";
import {
  addThreat,
  getThreatGenerationMultiplier,
  resolveThreatTarget,
} from "../../utils/threat.js";

function factionsHostile(world, sourceId, targetId) {
  const sourceFaction = String(world.get(sourceId, Faction)?.key || "");
  const targetFaction = String(world.get(targetId, Faction)?.key || "");
  return !!sourceFaction && !!targetFaction && areFactionsHostile(sourceFaction, targetFaction);
}

function canReceiveThreat(world, sourceId, targetId) {
  const source = Number(sourceId || 0) | 0;
  const target = Number(targetId || 0) | 0;
  if (!(source > 0) || !(target > 0) || source === target) return false;
  if (!world.isAlive(source) || !world.isAlive(target)) return false;
  if (!world.get(target, AggroState)) return false;
  const vit = world.get(target, Vitality);
  if (vit && (Number(vit.hp || 0) | 0) <= 0) return false;
  return factionsHostile(world, source, target);
}

export function threatDamageReactionSystem(world) {
  for (const [, damage] of world.query(DamageApplied)) {
    const owner = Number(damage.target || 0) | 0;
    const actor = Number(damage.source || 0) | 0;
    const value = Math.max(0, Number(damage.amount || 0) | 0);
    if (!(value > 0) || !canReceiveThreat(world, actor, owner)) continue;

    const mult = getThreatGenerationMultiplier(world, actor);
    addThreat(world, owner, actor, Math.max(1, Math.floor((value * mult) + 1e-6)), {
      kind: String(damage.cause || "damage"),
    });
    resolveThreatTarget(world, owner, { reason: "damage" });
  }
}
