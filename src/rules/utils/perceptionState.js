import { Traits } from "../components/Traits.js";
import { snapshotStatusState } from "./statusFacade.js";

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} playerId
 */
export function readPlayerPerceptionState(world, playerId) {
  const id = Number(playerId || 0) | 0;
  if (!(id > 0)) {
    return Object.freeze({
      thermalSense: 0,
      espSense: 0,
      memoryTamper: 0,
    });
  }
  const tr = world.get(id, Traits);
  const snap = snapshotStatusState(world, id);
  const strength = (key) => Number(snap?.statusStrengths?.get?.(String(key || "").toLowerCase()) || 0);
  const thermalSense = strength("thermal_sense");
  const espFromTrait = tr?.third_eye ? 1 : 0;
  const espFromStatus = strength("esp_sense")
    + strength("third_eye")
    + strength("spider_sense");
  const memoryTamper = strength("mindwiped")
    + strength("hallucinating");

  return Object.freeze({
    thermalSense: Math.max(0, thermalSense | 0),
    espSense: Math.max(0, (espFromTrait + espFromStatus) | 0),
    memoryTamper: Math.max(0, memoryTamper | 0),
  });
}
