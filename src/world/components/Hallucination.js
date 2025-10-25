// Hallucination.js
// ECS Component: Time-phased hallucination status with rendering-driven intensity
import { defineComponent } from '../../lib/ecs/core.js';

// Timeline phases are in seconds. Intensity is derived each frame by systems.
export const Hallucination = defineComponent('Hallucination', {
  // Lifecycle
  active: false,     // becomes true when first processed
  t: 0,              // elapsed seconds since start
  duration: 0,       // optional hard clamp; 0 means derive from phases
  onsetSec: 2.5,     // ramp-up time to peak
  sustainSec: 6.0,   // plateau at peak intensity
  comedownSec: 4.0,  // ramp-down back to baseline
  loop: false,       // loop timeline when true

  // Effect strength (0..1); final intensity = curve * strength
  strength: 1.0,
  intensity: 0.0,

  // Visual flavor controls (maximums at intensity=1)
  hueMaxDeg: 120,        // hue rotation range at peak
  saturationBoost: 1.6,  // extra saturate() at peak (1=no change)
  aberrationMaxPx: 6,    // chromatic shimmer/offset in CSS pixels
  wobbleAmpPx: 8,        // x-wobble amplitude in CSS pixels
  wobbleFreqHz: 1.2,     // wobble frequency
  vignetteStrength: 0.35,// vignette darken at edges (0..1)
  kaleidoAt: 0.65,       // intensity threshold to enable kaleidoscope overlay
  trailAlpha: 0.0,       // optional frame trail (0..1), 0 disables

  // RNG seed for deterministic wiggles (optional)
  seed: 0
});
