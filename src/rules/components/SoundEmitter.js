import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * SoundEmitter — the emission side of the Anatomy hearing system.
 *
 * Anatomy.hearing defines how sensitive a creature is to sound.
 * SoundEmitter defines how much sound a creature makes.
 *
 * Consumed by soundPropagationSystem (effects phase), which checks nearby
 * Anatomy hearing tiers against these values and may escalate AggroState.
 *
 * ambient:        Constant noise in dB emitted every turn (e.g. 30 = footstep level).
 *                 Use HEARING_SOURCE_DB.footsteps (30) for normal movement noise.
 * lastActionNoise: One-time noise spike in dB from the most recent significant action
 *                  (spell cast, explosion, shout, etc.). Decayed to 0 each tick
 *                  by soundPropagationSystem after it is processed.
 *
 * Detection range formula (tiles):
 *   floor( (max(ambient, lastActionNoise) - HEARING_HL_THRESHOLD[tier]) / 3 )
 *
 * Examples with ambient = 30 (footsteps):
 *   super (threshold 20) → detected at 3 tiles
 *   far   (threshold 30) → detected at 0 tiles (adjacent only)
 *   mid+  (threshold 50+)→ cannot detect footsteps at all
 *
 * Examples with lastActionNoise = 80 (shout/spell):
 *   super  → 20 tiles    far → 16 tiles
 *   mid    → 10 tiles    near → 3 tiles
 */
export const SoundEmitter = defineComponent("SoundEmitter", {
  ambient:         0,   // dB: constant per-turn noise
  lastActionNoise: 0,   // dB: one-shot noise from last action; zeroed each tick
});
