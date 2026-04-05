// Synthesized sound definitions — each is (ac, dest, opts?) => void.
// No audio files; everything is built from oscillators and noise.

import { tone, noiseBurst } from "./audioEngine.js";

// ── Combat ──────────────────────────────────────────────────

/** Melee hit — short thud + metallic ring. opts.critical scales gain. */
export function meleeHit(ac, dest, opts) {
  const crit = opts?.critical;
  const g = crit ? 0.4 : 0.25;
  // Impact thud
  noiseBurst(ac, 0, 0.06, g, dest);
  // Metallic ring
  tone(ac, crit ? 600 : 440, 0.01, 0.08, "square", g * 0.3, dest);
  if (crit) {
    // Extra crunch on crits
    noiseBurst(ac, 0.03, 0.04, 0.3, dest);
    tone(ac, 800, 0.02, 0.06, "sawtooth", 0.15, dest);
  }
}

/** Melee miss — light whoosh. */
export function meleeMiss(ac, dest) {
  noiseBurst(ac, 0, 0.12, 0.08, dest);
  tone(ac, 300, 0, 0.1, "sine", 0.03, dest);
}

/** Ranged shot — twang + whoosh. */
export function rangedShot(ac, dest) {
  tone(ac, 220, 0, 0.04, "sawtooth", 0.15, dest);
  tone(ac, 330, 0.01, 0.06, "triangle", 0.1, dest);
  noiseBurst(ac, 0.03, 0.15, 0.06, dest);
}

/** Entity death — low thump + descending tone. */
export function death(ac, dest) {
  noiseBurst(ac, 0, 0.1, 0.3, dest);
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = "sine";
  const t0 = ac.currentTime;
  osc.frequency.setValueAtTime(180, t0);
  osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.3);
  env.gain.setValueAtTime(0.2, t0);
  env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
  osc.connect(env);
  env.connect(dest);
  osc.start(t0);
  osc.stop(t0 + 0.4);
}

// ── Items ───────────────────────────────────────────────────

/** Item pickup — bright ascending chime. */
export function pickup(ac, dest) {
  tone(ac, 523, 0, 0.06, "sine", 0.15, dest);     // C5
  tone(ac, 659, 0.05, 0.06, "sine", 0.12, dest);   // E5
  tone(ac, 784, 0.1, 0.08, "sine", 0.1, dest);     // G5
}

/** Item drop — soft descending blip. */
export function drop(ac, dest) {
  tone(ac, 440, 0, 0.06, "sine", 0.1, dest);
  tone(ac, 330, 0.05, 0.08, "sine", 0.08, dest);
}

/** Equip — clank. */
export function equip(ac, dest) {
  noiseBurst(ac, 0, 0.03, 0.15, dest);
  tone(ac, 500, 0.01, 0.1, "square", 0.08, dest);
}

// ── Movement ────────────────────────────────────────────────

/** Footstep — subtle tap. */
export function footstep(ac, dest) {
  noiseBurst(ac, 0, 0.03, 0.06, dest);
  tone(ac, 120, 0, 0.04, "sine", 0.04, dest);
}

/** Door open — creak. */
export function doorOpen(ac, dest) {
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = "sawtooth";
  const t0 = ac.currentTime;
  osc.frequency.setValueAtTime(80, t0);
  osc.frequency.linearRampToValueAtTime(200, t0 + 0.15);
  osc.frequency.linearRampToValueAtTime(100, t0 + 0.25);
  env.gain.setValueAtTime(0.06, t0);
  env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
  osc.connect(env);
  env.connect(dest);
  osc.start(t0);
  osc.stop(t0 + 0.35);
}

/** Stair traverse — descending/ascending sweep. */
export function stairTraverse(ac, dest, opts) {
  const down = opts?.direction === "down";
  const f0 = down ? 500 : 200;
  const f1 = down ? 200 : 500;
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = "triangle";
  const t0 = ac.currentTime;
  osc.frequency.setValueAtTime(f0, t0);
  osc.frequency.exponentialRampToValueAtTime(f1, t0 + 0.3);
  env.gain.setValueAtTime(0.12, t0);
  env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
  osc.connect(env);
  env.connect(dest);
  osc.start(t0);
  osc.stop(t0 + 0.4);
}

// ── Spells ──────────────────────────────────────────────────

/** Spell bolt — electric zap. */
export function spellBolt(ac, dest) {
  // Crackle
  noiseBurst(ac, 0, 0.08, 0.2, dest);
  // Zap tone
  tone(ac, 880, 0, 0.06, "sawtooth", 0.15, dest);
  tone(ac, 1200, 0.02, 0.05, "square", 0.08, dest);
}

/** Spell area — deep whomp + shimmer. */
export function spellArea(ac, dest) {
  // Bass whomp
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = "sine";
  const t0 = ac.currentTime;
  osc.frequency.setValueAtTime(150, t0);
  osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.2);
  env.gain.setValueAtTime(0.25, t0);
  env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
  osc.connect(env);
  env.connect(dest);
  osc.start(t0);
  osc.stop(t0 + 0.35);
  // Shimmer
  tone(ac, 1000, 0.05, 0.15, "sine", 0.06, dest);
  tone(ac, 1500, 0.08, 0.12, "sine", 0.04, dest);
}

/** Spell fizzle — sad descending wah. */
export function spellFizzle(ac, dest) {
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = "triangle";
  const t0 = ac.currentTime;
  osc.frequency.setValueAtTime(400, t0);
  osc.frequency.exponentialRampToValueAtTime(100, t0 + 0.25);
  env.gain.setValueAtTime(0.12, t0);
  env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
  osc.connect(env);
  env.connect(dest);
  osc.start(t0);
  osc.stop(t0 + 0.35);
}

// ── Ambient ─────────────────────────────────────────────────

/** Rain loop tick — single raindrop. */
export function raindrop(ac, dest) {
  tone(ac, 2000 + Math.random() * 2000, 0, 0.02, "sine", 0.03, dest);
  noiseBurst(ac, 0, 0.015, 0.02, dest);
}

/** Thunder rumble — deep noise + bass. */
export function thunder(ac, dest) {
  noiseBurst(ac, 0, 0.8, 0.25, dest);
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = "sine";
  const t0 = ac.currentTime;
  osc.frequency.setValueAtTime(50, t0);
  osc.frequency.exponentialRampToValueAtTime(25, t0 + 0.6);
  env.gain.setValueAtTime(0.3, t0 + 0.05);
  env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.8);
  osc.connect(env);
  env.connect(dest);
  osc.start(t0);
  osc.stop(t0 + 0.9);
}

/** Fountain — bubbly water blip. */
export function fountain(ac, dest) {
  tone(ac, 600 + Math.random() * 200, 0, 0.05, "sine", 0.06, dest);
  tone(ac, 800 + Math.random() * 300, 0.03, 0.04, "sine", 0.04, dest);
}

// ── UI ──────────────────────────────────────────────────────

/** Level up — triumphant ascending fanfare. */
export function levelUp(ac, dest) {
  tone(ac, 523, 0,    0.1,  "triangle", 0.2, dest);  // C5
  tone(ac, 659, 0.08, 0.1,  "triangle", 0.18, dest); // E5
  tone(ac, 784, 0.16, 0.1,  "triangle", 0.16, dest); // G5
  tone(ac, 1047, 0.24, 0.2, "triangle", 0.22, dest); // C6
}
