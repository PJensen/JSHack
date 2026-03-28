import { SetPostureIntent } from "../components/Intents/SetPostureIntent.js";
import { COMBAT_POSTURES } from "../components/CombatPosture.js";
import { getPostureState, setCombatPosture } from "../utils/posture.js";

const ORDER = Object.freeze([
  COMBAT_POSTURES.balanced,
  COMBAT_POSTURES.aggressive,
  COMBAT_POSTURES.guarded,
]);

function normalizeRequested(stance) {
  const value = String(stance || "").toLowerCase();
  if (value === COMBAT_POSTURES.aggressive) return COMBAT_POSTURES.aggressive;
  if (value === COMBAT_POSTURES.guarded) return COMBAT_POSTURES.guarded;
  if (value === COMBAT_POSTURES.balanced) return COMBAT_POSTURES.balanced;
  return "";
}

function nextPosture(current) {
  const idx = ORDER.indexOf(current);
  if (idx < 0) return COMBAT_POSTURES.balanced;
  return ORDER[(idx + 1) % ORDER.length];
}

/** Resolve and consume SetPostureIntent as a turn action. */
export function postureIntentSystem(world) {
  for (const [id, intent] of world.query(SetPostureIntent)) {
    try {
      const current = getPostureState(world, id)?.stance || COMBAT_POSTURES.balanced;
      const requested = normalizeRequested(intent?.stance);
      const mode = String(intent?.mode || "cycle").toLowerCase();
      const target = requested || (mode === "set" ? current : nextPosture(current));
      setCombatPosture(world, id, target, { reason: "intent:posture" });
    } catch (e) {
      console.error("[postureIntentSystem] failed:", e);
    }
    try { world.remove(id, SetPostureIntent); } catch {}
  }
}
