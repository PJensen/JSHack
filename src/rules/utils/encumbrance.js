import { Stamina } from "../components/Stamina.js";
import {
  CARRY_KG_PER_STAMINA,
  HEAVY_LOAD_RATIO,
  MAX_LOAD_RATIO,
} from "../data/encumbranceTuning.js";
import { getPassiveBonuses } from "./passiveBonuses.js";

export function getCarryCapacity(world, actorId) {
  const stamina = world.get(actorId, Stamina);
  if (!stamina) return null;
  const bonus = Number(getPassiveBonuses(world, actorId)?.maxStaminaDerived ?? 0);
  const effectiveMax = Math.max(0, Number(stamina.maxStamina || 0) + bonus);
  return effectiveMax > 0 ? effectiveMax * CARRY_KG_PER_STAMINA : null;
}

export function resolveEncumbrance(current, limit) {
  const weight = Math.max(0, Number(current || 0));
  const capacity = Number(limit);
  if (!(capacity > 0)) {
    return { limit: null, hardLimit: null, loadRatio: 0, heavilyLoaded: false, overloaded: false };
  }
  const loadRatio = weight / capacity;
  return {
    limit: capacity,
    hardLimit: capacity * MAX_LOAD_RATIO,
    loadRatio,
    heavilyLoaded: loadRatio > HEAVY_LOAD_RATIO,
    overloaded: loadRatio > 1,
  };
}

export function canAddCarriedWeight(current, added, limit) {
  if (!(Number(added) > 0)) return true;
  if (!(Number(limit) > 0)) return true;
  return Math.max(0, Number(current || 0)) + Math.max(0, Number(added || 0))
    <= Number(limit) * MAX_LOAD_RATIO;
}
