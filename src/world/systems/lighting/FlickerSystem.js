// FlickerSystem: deterministic intensity modulation for lights
import { Light } from '../../components/Light.js';

function hash32(x){
  // simple integer hash
  x |= 0; x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b); x ^= x >>> 16; return x >>> 0;
}

function noise01(seed){
  // quick PRNG per-call based on seed
  let x = hash32(seed);
  x = (x + 0x6D2B79F5) >>> 0;
  let t = Math.imul(x ^ (x >>> 15), 1 | x);
  t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function FlickerSystem(world, dt){
  const tMs = world.time * 1000;
  const baseSeed = world.seed >>> 0;
  for (const [id, lt] of world.query(Light)){
    // base intensity
    const baseI = (lt.intensity != null) ? lt.intensity : 1.0;
    let eff = baseI;

    if (lt.flickerSeed != null){
      const s = hash32(baseSeed ^ id ^ (lt.flickerSeed|0) ^ ((tMs/67)|0));
      const n = noise01(s); // 0..1
      eff *= 0.9 + 0.1 * n; // gentle
    }
    if (lt.pulse && lt.pulse.periodMs){
      const p = Math.max(1, lt.pulse.periodMs|0);
      const phase = (tMs % p) / p;
      const s = Math.sin(phase * Math.PI * 2) * 0.5 + 0.5; // 0..1
      const min = lt.pulse.min ?? 0.8, max = lt.pulse.max ?? 1.2;
      const k = min + (max - min) * s;
      eff *= k;
    }

    // write effective intensity for this frame
    if (lt.intensityEff !== eff){
      world.mutate(id, Light, (rec)=>{ rec.intensityEff = eff; });
    }
  }
}
