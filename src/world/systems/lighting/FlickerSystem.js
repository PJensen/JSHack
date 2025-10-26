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

function toRGB(color){
  if (!color) return [1,1,1];
  if (Array.isArray(color)) return [color[0]||0, color[1]||0, color[2]||0];
  if (typeof color === 'string'){
    const s = color.trim();
    if (s[0] === '#'){
      const n = parseInt(s.slice(1), 16);
      const r = ((n>>16)&255)/255, g=((n>>8)&255)/255, b=(n&255)/255;
      return [r,g,b];
    }
  }
  return [1,1,1];
}

export function FlickerSystem(world, dt){
  const tMs = world.time * 1000;
  const baseSeed = world.seed >>> 0;
  for (const [id, lt] of world.query(Light)){
    // base intensity
    const baseI = (lt.intensity != null) ? lt.intensity : 1.0;
    let eff = baseI;

    // Enhanced random flicker using interpolated value noise
    // Back-compat: if lt.flicker exists, use its config; else fall back to legacy gentle jitter.
    if (lt.flickerSeed != null){
      const cfg = lt.flicker || null;
      const seed = hash32(baseSeed ^ id ^ (lt.flickerSeed|0));
  if (cfg && cfg.style === 'torch'){
        // Advanced torch flicker: multi-band smooth noise + rare sputter/surge events
        // Tunables with sensible defaults
        const amp   = (cfg.amplitude != null) ? Math.max(0, cfg.amplitude) : 0.35;
        const speed = (cfg.speed != null) ? Math.max(0.01, cfg.speed) : 1.0;
        const hiMs  = Math.max(12, (cfg.hiMs|0)  || 40);   // fast shimmer
        const midMs = Math.max(40, (cfg.midMs|0) || 110);  // body
        const lowMs = Math.max(120,(cfg.lowMs|0) || 400);  // drift
        const wHi = (cfg.wHi != null) ? cfg.wHi : 0.5;
        const wMid= (cfg.wMid!= null) ? cfg.wMid: 0.35;
        const wLow= (cfg.wLow!= null) ? cfg.wLow: 0.15;
        const gamma = (cfg.gamma != null) ? Math.max(0.1, cfg.gamma) : 1.3; // emphasize dips a bit

        // Smoothstep for nicer interpolation
        const smooth = (x)=>{ return x*x*(3-2*x); };
        const band = (periodMs)=>{
          const t = (tMs * speed) / periodMs;
          const k = Math.floor(t);
          const f = smooth(t - k);
          const n0 = noise01(seed ^ hash32(k));
          const n1 = noise01(seed ^ hash32(k + 1));
          return n0 + (n1 - n0) * f; // 0..1
        };
        // Multi-band fBm-like noise (weighted)
        let v = (band(hiMs) * wHi) + (band(midMs) * wMid) + (band(lowMs) * wLow);
        const norm = (wHi + wMid + wLow) || 1;
        v = v / norm; // 0..1
        // Shape response to prefer warm, uneven dips
        v = Math.pow(v, gamma); // still 0..1
        const sym = v * 2 - 1; // -1..1
        let m = 1 + sym * amp;

        // Radius breathing (slow band)
        const rAmp = (cfg.radiusAmp != null) ? Math.max(0, cfg.radiusAmp) : 0.12;
        const low = band(lowMs) * 2 - 1;
        const baseR = (lt.radius != null) ? lt.radius : 6;
        const rEff = Math.max(0.25, baseR * (1 + rAmp * low));

        // Subtle warm tinting with heat
        const tAmp = (cfg.tintAmp != null) ? Math.max(0, cfg.tintAmp) : 0.25;
        const heat = Math.max(0, Math.min(1, 0.5 + 0.5 * v)); // 0..1, more when bright
        const baseRgb = toRGB(lt.color);
        // Push toward warmer (reduce B more than G, slightly boost R)
        const kR = 1 + 0.12 * tAmp * heat;
        const kG = 1 - 0.30 * tAmp * heat;
        const kB = 1 - 0.65 * tAmp * heat;
        const cEff = [
          Math.max(0, Math.min(1, baseRgb[0] * kR)),
          Math.max(0, Math.min(1, baseRgb[1] * kG)),
          Math.max(0, Math.min(1, baseRgb[2] * kB)),
        ];

  // Rare transient sputter (drop) and surge (flare) events
        // Keep a tiny bit of state on the Light component (safe in this ECS)
        let fx = lt.flickerFx; if (!fx) fx = (lt.flickerFx = {});
        const now = tMs;
        const rand01 = (tag)=> noise01(seed ^ hash32(tag) ^ hash32((now/123)|0));

        // Schedule events via simple Poisson using dt
        const pSput = Math.max(0, cfg.sputterPerSec ?? 0.5) * Math.max(0, dt);
        const pSurge = Math.max(0, cfg.surgePerSec ?? 0.25) * Math.max(0, dt);
        // Start sputter if none active
        if (!fx.sputterUntil || now >= fx.sputterUntil){
          if (rand01(0xA11CE) < pSput){
            const len = Math.max(20, Math.min(220, (cfg.sputterLenMs ?? (60 + (rand01(0xBEEf)*70)|0))|0));
            fx.sputterStart = now; fx.sputterUntil = now + len;
          }
        }
        // Start surge occasionally (independent)
        if (!fx.surgeUntil || now >= fx.surgeUntil){
          if (rand01(0xC0DE) < pSurge){
            const len = Math.max(15, Math.min(180, (cfg.surgeLenMs ?? (50 + (rand01(0xF00D)*50)|0))|0));
            fx.surgeStart = now; fx.surgeUntil = now + len;
          }
        }
        // Apply envelopes
        const dropAmt = Math.max(0, Math.min(1, cfg.sputterDrop ?? 0.35));
        if (fx.sputterUntil && now < fx.sputterUntil){
          const u = (now - fx.sputterStart) / Math.max(1, (fx.sputterUntil - fx.sputterStart));
          const e = Math.sin(Math.PI * u); // nice 0..1..0 bell
          m *= Math.max(0, 1 - dropAmt * e);
        }
        const surgeAmt = Math.max(0, Math.min(2, cfg.surgeAmp ?? 0.2));
        if (fx.surgeUntil && now < fx.surgeUntil){
          const u = (now - fx.surgeStart) / Math.max(1, (fx.surgeUntil - fx.surgeStart));
          const e = Math.sin(Math.PI * u);
          m *= (1 + surgeAmt * e);
        }

        eff *= Math.max(0, m);
        // write effective derived values
        lt.radiusEff = rEff;
        lt.colorEff = cEff;
      } else if (cfg){
        // Original config path: value-noise octaves
        const period = Math.max(10, (cfg.periodMs|0) || 60); // ms between new random samples
        const octaves = Math.max(1, (cfg.octaves|0) || 1);
        const amp = (cfg.amplitude != null) ? Math.max(0, cfg.amplitude) : 0.08; // multiplier deviation around 1

        // time within current bucket
        const bucketF = tMs / period;
        const k0 = Math.floor(bucketF);
        const fracRaw = bucketF - k0;
        const frac = (fracRaw*fracRaw*(3-2*fracRaw)); // smoothstep instead of linear

        // Interpolated value noise with optional octaves (fbm)
        let v = 0, a = 1, norm = 0, freq = 1;
        for (let o=0;o<octaves;o++){
          const kk0 = (k0 * freq) | 0;
          const n0 = noise01(seed ^ hash32(kk0));
          const n1 = noise01(seed ^ hash32(kk0 + 1));
          const nv = n0 + (n1 - n0) * frac; // smooth lerp
          v += nv * a;
          norm += a;
          a *= 0.5; // half amplitude each octave
          freq *= 2;
        }
        v = (norm > 0) ? (v / norm) : 0.5; // 0..1
        const sym = v * 2 - 1;             // -1..1
        const m = 1 + sym * amp;           // 1±amp
        eff *= Math.max(0, m);
      } else {
        // Legacy: subtle one-sided jitter
        const s = hash32(baseSeed ^ id ^ (lt.flickerSeed|0) ^ ((tMs/67)|0));
        const n = noise01(s); // 0..1
        eff *= 0.9 + 0.1 * n; // gentle
      }
    }
    if (lt.pulse && lt.pulse.periodMs){
      const p = Math.max(1, lt.pulse.periodMs|0);
      const phase = (tMs % p) / p;
      const s = Math.sin(phase * Math.PI * 2) * 0.5 + 0.5; // 0..1
      const min = lt.pulse.min ?? 0.8, max = lt.pulse.max ?? 1.2;
      const k = min + (max - min) * s;
      eff *= k;
    }

    // write effective intensity for this frame immediately so lighting sees it this tick
    if (lt.intensityEff !== eff){
      lt.intensityEff = eff;        // direct write: live record, visible to later systems this frame
      try { world.markChanged(id, Light); } catch(_) { /* optional */ }
    }
  }
}
