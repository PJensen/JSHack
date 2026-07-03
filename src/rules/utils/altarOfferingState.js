import { AltarOfferingState } from "../components/AltarOfferingState.js";
import { TURNS_PER_DAY } from "../data/calendar.js";

export function altarOfferingDay(world) {
  return Math.floor(Math.max(0, Number(world?.step || 0)) / TURNS_PER_DAY) | 0;
}

export function altarOfferingExpiresAtTurn(world) {
  return (altarOfferingDay(world) + 1) * TURNS_PER_DAY;
}

export function isAltarOfferingActive(world, altarId) {
  const state = world?.get?.(altarId, AltarOfferingState);
  if (!state) return false;
  return (Number(state.expiresAtTurn ?? -1) | 0) > (Number(world?.step || 0) | 0);
}
