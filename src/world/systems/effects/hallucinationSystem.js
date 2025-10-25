// Hallucination timeline system
// Updates Hallucination component: advances time, computes intensity curve, ends/removes when done.
import { Hallucination } from '../../components/Hallucination.js';

function easeInSine(t){ return 1 - Math.cos((t * Math.PI) / 2); }
function easeOutSine(t){ return Math.sin((t * Math.PI) / 2); }
function clamp01(x){ return x < 0 ? 0 : x > 1 ? 1 : x; }

export function hallucinationSystem(world, dt){
  if (!dt || dt <= 0) return;
  for (const [id, h] of world.query(Hallucination)){
    // Initialize on first tick
    if (!h.active){ h.active = true; if (!h.seed) h.seed = (world.seed ^ (id * 2654435761)) >>> 0; }

    // Advance time
    h.t += dt;

    // Determine total duration
    const onset = Math.max(0, +h.onsetSec || 0);
    const sustain = Math.max(0, +h.sustainSec || 0);
    const comedown = Math.max(0, +h.comedownSec || 0);
    const phasedTotal = onset + sustain + comedown;
    const total = (h.duration && h.duration > 0) ? h.duration : phasedTotal;

    // Compute normalized intensity (0..1) across phases
    let u = 0;
    const t = h.t;
    if (total <= 0){
      u = 0;
    } else if (t <= onset){
      const x = onset > 0 ? (t / onset) : 1;
      u = easeInSine(clamp01(x));
    } else if (t <= onset + sustain){
      u = 1;
    } else if (t <= (onset + sustain + comedown)){
      const x = comedown > 0 ? ((t - onset - sustain) / comedown) : 1;
      u = 1 - easeOutSine(clamp01(x));
    } else {
      u = 0;
    }

    h.intensity = clamp01((+h.strength || 0) * u);

    // Wiggle the curve slightly with a very low-frequency tremor, feels organic
    if (h.intensity > 0){
      const wobble = 0.06 * Math.sin((world.time * 0.7) + (id * 12.9898));
      h.intensity = clamp01(h.intensity + wobble);
    }

    // Mark as changed for any systems using Changed(Hallucination)
    try { world.markChanged(id, Hallucination); } catch(_) {}

    // Handle completion
    if (total > 0 && h.t >= total){
      if (h.loop){
        h.t = 0;
      } else {
        // Remove component when done to free queries
        try { world.remove(id, Hallucination); } catch(_) {}
      }
    }
  }
}
