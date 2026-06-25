import { FountainState } from "../../../rules/components/FountainState.js";
import { mulberry32 } from "../../../rules/utils/rng.js";
import { FountainDried } from "../../../events/FountainDried.js";

const MIN_CHARGES = 2;
const MAX_CHARGES = 4;
const COOLDOWN_MIN = 201;
const COOLDOWN_MAX = 259;

function seeded(world, targetId, salt) {
  return mulberry32(((world.seed >>> 0) ^ (((targetId | 0) * 0x9e3779b9) >>> 0) ^ salt) >>> 0);
}

export function ensureFountainState(world, targetId) {
  const current = world.get(targetId, FountainState);
  if (!current) throw new Error(`Fountain ${targetId} is missing FountainState`);
  if (current.initialized === true) return current;

  const chargeRng = seeded(world, targetId, 0xF017);
  const modeRng = seeded(world, targetId, 0xF0AD);
  const cooldownRng = seeded(world, targetId, 0xF0CD);
  const maxCharges = MIN_CHARGES + Math.floor(chargeRng() * (MAX_CHARGES - MIN_CHARGES + 1));
  let cooldownTurns = COOLDOWN_MIN + Math.floor(cooldownRng() * (COOLDOWN_MAX - COOLDOWN_MIN + 1));
  if ((cooldownTurns & 1) === 0) cooldownTurns += cooldownTurns < COOLDOWN_MAX ? 1 : -1;
  const next = {
    initialized: true,
    chargesRemaining: maxCharges,
    maxCharges,
    primaryEffect: modeRng() < 0.5 ? "heal" : "mana",
    cooldownTurns,
    dryUntilStep: -1,
  };
  world.set(targetId, FountainState, next);
  return world.get(targetId, FountainState);
}

export function spendFountainCharge(world, actor, targetId) {
  const state = ensureFountainState(world, targetId);
  const chargesRemaining = Math.max(0, (state.chargesRemaining | 0) - 1);
  if (chargesRemaining > 0) {
    world.set(targetId, FountainState, { ...state, chargesRemaining });
    return;
  }
  const dryUntilStep = (Number(world.step || 0) | 0) + state.cooldownTurns;
  world.set(targetId, FountainState, { ...state, chargesRemaining: 0, dryUntilStep });
  world.emit(new FountainDried({
    actor,
    targetId,
    cooldownTurns: state.cooldownTurns,
    dryUntilStep,
  }));
}
