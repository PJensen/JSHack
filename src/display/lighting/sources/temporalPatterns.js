// display/lighting/sources/temporalPatterns.js
// Named temporal waveform patterns for light sources.
//
// Each pattern is a function(t, id) → { intensity, r, g, b }
//   t  = fxTime in seconds (monotonic, frame-interpolated)
//   id = entity id (for per-source phase offset so identical lights desync)
//
// intensity: multiplier applied to light radius and brightness (0.0 – ~1.5)
// r, g, b:   additive RGB shift (-1.0 to 1.0, applied as color *= 1+shift)
//            Most patterns leave these at 0 (neutral).
//
// Usage in collectLightSources:
//   const p = evaluatePattern('torch', fxTime, entityId);
//   out.push({ ..., radius: base * p.intensity, flicker: p.intensity });

/** @typedef {{ intensity: number, r: number, g: number, b: number }} PatternResult */

/** Shared scratch object — avoids allocation per evaluation. */
const _result = { intensity: 1, r: 0, g: 0, b: 0 };

/** Return the scratch result with given values. */
function out(intensity, r, g, b) {
  _result.intensity = intensity;
  _result.r = r; _result.g = g; _result.b = b;
  return _result;
}

// ---- Pattern definitions --------------------------------------------------

/**
 * Torch — warm, organic flicker. Slow sway + medium wobble + shimmer + jitter.
 * Range: ~0.76 – 1.15.  The classic.
 */
function torch(t, id) {
  const v = 1.0
    + 0.10 * Math.sin(t * 1.4  + id)
    + 0.06 * Math.sin(t * 3.1  + id * 0.7)
    + 0.04 * Math.sin(t * 5.9)
    + 0.04 * (Math.random() - 0.5);
  return out(v, 0, 0, 0);
}

/**
 * Ember — slow smolder with occasional bright flare.
 * Base sits at ~0.75, punctuated by brief bright peaks.
 * Good for dying fires, furnaces cooling down, fire pits.
 * Range: ~0.67 – 1.12.
 */
function ember(t, id) {
  const phase = t * 0.8 + id * 1.3;
  const base = 0.75 + 0.08 * Math.sin(phase);
  // Flare: narrow bright spike every ~4 seconds (per-entity offset)
  const flareCycle = (t * 0.25 + id * 0.37) % 1.0;
  const flare = flareCycle > 0.85 ? (flareCycle - 0.85) / 0.15 : 0;
  const flareShape = flare * flare * (3 - 2 * flare);  // smoothstep
  const v = base + flareShape * 0.35;
  // Slight red shift during flare
  return out(v, flareShape * 0.12, -flareShape * 0.04, -flareShape * 0.06);
}

/**
 * Breathe — very slow sinusoidal swell. Calm, meditative.
 * Good for altars, shrines, sleeping enchantments.
 * Range: ~0.5 – 1.0.
 */
function breathe(t, id) {
  const phase = t * 0.4 + id * 2.1;
  const v = 0.85 + 0.15 * Math.sin(phase);
  return out(v, 0, 0, 0);
}

/**
 * Occult — irregular, unsettling rhythm. Phase-shifted harmonics that
 * never quite settle into a pattern. Feels wrong.
 * Good for cursed objects, shadow magic, void artifacts.
 * Range: ~0.62 – 1.02.
 */
function occult(t, id) {
  const p = id * 0.91;
  const v = 0.82
    + 0.10 * Math.sin(t * 1.1 + p)
    + 0.07 * Math.sin(t * 1.7 + p * 1.3)
    + 0.05 * Math.sin(t * 2.9 + p * 0.5)
    + 0.04 * Math.sin(t * 4.3 + p * 2.1);
  // Subtle purple-shift
  return out(v, -0.04, -0.06, 0.05);
}

/**
 * Pulse — steady metronome. Bright peak with dimmer rest.
 * Period ~2 seconds. Good for mechanical, magical, or divine sources.
 * Range: 0.65 – 1.0.
 */
function pulse(t, id) {
  const phase = (t * 0.5 + id * 0.73) % 1.0;
  // Smooth pulse: steep rise, brief hold, steep fall
  let v;
  if (phase < 0.15)      v = phase / 0.15;                        // rise
  else if (phase < 0.35) v = 1.0;                                 // hold
  else if (phase < 0.50) v = 1.0 - (phase - 0.35) / 0.15;        // fall
  else                   v = 0.0;                                  // off
  v = v * v * (3 - 2 * v);  // smoothstep the transitions
  return out(0.65 + v * 0.35, 0, 0, 0);
}

/**
 * Storm — fast crackling with random spikes. Electric, dangerous.
 * Good for storm magic, lightning enchantments, charged objects.
 * Range: ~0.63 – 1.15.
 */
function storm(t, id) {
  const base = 0.78 + 0.10 * Math.sin(t * 2.3 + id);
  // Fast crackle
  const crackle = 0.08 * Math.sin(t * 11.0 + id * 3.1)
    + 0.06 * Math.sin(t * 17.0 + id * 1.7);
  // Random spike
  const spike = Math.random() > 0.92 ? 0.25 * Math.random() : 0;
  const v = base + crackle + spike;
  // Cool white shift during spikes
  const s = spike > 0.1 ? 0.08 : 0;
  return out(v, -s * 0.5, -s * 0.2, s * 0.3);
}

/**
 * Bioluminescence — very slow drift with subtle color temperature shift.
 * Organic, underwater, alien. For mushrooms, deep cave life, lichen.
 * Range: ~0.68 – 0.95 (never fully bright — always slightly dim, always legible).
 */
function biolum(t, id) {
  const phase = t * 0.25 + id * 1.7;
  const v = 0.80
    + 0.10 * Math.sin(phase)
    + 0.05 * Math.sin(phase * 2.3 + 1.1);
  // Gentle green-blue color drift
  const drift = Math.sin(phase * 0.7) * 0.06;
  return out(v, -drift * 0.5, drift, drift * 0.3);
}

/**
 * Heartbeat — double-pulse (lub-dub) with resting glow between.
 * Visceral, alive. Good for blood magic, living artifacts, demonic items.
 * ~1.2 second cycle.  Range: 0.65 – 1.0.
 */
function heartbeat(t, id) {
  const phase = (t * 0.83 + id * 0.61) % 1.0;
  // lub at 0.0-0.12, dub at 0.18-0.28, rest 0.28-1.0
  let v = 0;
  if (phase < 0.12) {
    const p = phase / 0.12;
    v = Math.sin(p * Math.PI);        // lub (strong)
  } else if (phase >= 0.18 && phase < 0.28) {
    const p = (phase - 0.18) / 0.10;
    v = Math.sin(p * Math.PI) * 0.65; // dub (weaker)
  }
  // Slight red flush on beat
  return out(0.65 + v * 0.35, v * 0.10, -v * 0.03, -v * 0.05);
}

/**
 * Candle — like torch but gentler, with longer sway period and
 * occasional soft dips. Intimate, fragile.
 * Range: ~0.62 – 0.97.
 */
function candle(t, id) {
  const phase = t + id * 1.1;
  const base = 0.88
    + 0.06 * Math.sin(phase * 0.9)
    + 0.03 * Math.sin(phase * 2.4 + 0.5);
  // Rare dip — gentle wind gust (never kills the light)
  const dipCycle = (t * 0.12 + id * 0.53) % 1.0;
  const dip = dipCycle > 0.92 ? (1 - (dipCycle - 0.92) / 0.08) : 1;
  const v = base * (0.7 + 0.3 * dip);
  return out(v, 0, 0, 0);
}

/**
 * Holy — steady radiance with slow, stately swell.
 * Warm, reassuring. For divine blessings, consecrated ground.
 * Range: 0.85 – 1.05 (barely flickers — confidence, not chaos).
 */
function holy(t, id) {
  const v = 0.95
    + 0.05 * Math.sin(t * 0.6 + id * 1.4)
    + 0.03 * Math.sin(t * 1.1 + id * 0.3);
  return out(v, 0.02, 0.01, 0);
}

/**
 * Void — slow, predatory hunger. Light-devouring darkness that breathes.
 * Irregular rhythm with occasional deep gulps where the void swallows harder.
 * Good for voidstone, shadow lich aura, dark artifacts, void spell scars.
 * Range: 0.7 – 1.1 (applied to negative color, so higher = more darkness).
 */
function voidPattern(t, id) {
  const p = id * 0.77;
  const base = 0.85
    + 0.10 * Math.sin(t * 0.7 + p)
    + 0.06 * Math.sin(t * 1.3 + p * 1.5);
  // Occasional deep gulp — the void inhales
  const gulpCycle = (t * 0.18 + id * 0.43) % 1.0;
  const gulp = gulpCycle > 0.88 ? (gulpCycle - 0.88) / 0.12 : 0;
  const gulpShape = gulp * gulp * (3 - 2 * gulp);  // smoothstep
  const v = base + gulpShape * 0.25;
  return out(v, 0, 0, 0);
}

// ---- Registry -------------------------------------------------------------

/** @type {Record<string, (t:number, id:number) => PatternResult>} */
const PATTERNS = {
  torch,
  ember,
  breathe,
  occult,
  pulse,
  storm,
  biolum,
  heartbeat,
  candle,
  holy,
  void: voidPattern,
};

/**
 * Evaluate a named temporal pattern.
 * Returns a shared result object — copy values before calling again.
 *
 * @param {string} name — pattern name (case-sensitive)
 * @param {number} t — fxTime in seconds
 * @param {number} id — entity id for phase offset
 * @returns {PatternResult}
 */
export function evaluatePattern(name, t, id) {
  const fn = PATTERNS[name];
  if (!fn) return out(1, 0, 0, 0);  // unknown pattern = steady
  return fn(t, id);
}

/** List all available pattern names. */
export function getPatternNames() {
  return Object.keys(PATTERNS);
}
