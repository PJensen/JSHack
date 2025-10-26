import { Effect } from '../../components/Effect.js';
import { createParticleSystem } from './particleSystem.js';
import { getRenderContext } from '../render/utils.js';
import { RenderContext } from '../../components/RenderContext.js';
import { ftPreset } from './floatTextPresets.js';

// Convenience helper to spawn common effects
export function spawnFloatText(world, x, y, a, b = {}){
  // Supports both legacy signature (x,y,text,opts) and new spec (x,y,spec)
  const spec = (typeof a === 'string' || typeof a === 'number')
    ? { ...(b || {}), text: String(a) }
    : (a || {});

  // Safety caps to avoid unbounded effect entity creation (OOM)
  const MAX_FLOAT_TEXT = 512; // max simultaneous float text effects
  const MAX_TOTAL_EFFECTS = 2048; // safety cap for all effects
  try{
    const activeFloat = world.query(Effect, { where: (eff) => eff && eff.type === 'float_text' }).count();
    if (activeFloat >= MAX_FLOAT_TEXT){
      if (spec && spec.batch) return null; // drop low-priority float texts when we're at capacity
      return null;
    }
    const totalEff = world.query(Effect).count();
    if (totalEff >= MAX_TOTAL_EFFECTS){
      return null;
    }
  } catch(_) { /* ignore count errors */ }

  const e = world.create();

  // Map new spec to internal parameters
  const text = String(spec.text ?? '');
  const color = spec.color || '#ffffff';
  const life = (typeof spec.life === 'number') ? spec.life : 1.0;
  const size = clamp((typeof spec.size === 'number') ? spec.size : 1.0, 0, 2);
  const energy = clamp((typeof spec.energy === 'number') ? spec.energy : 0.2, 0, 1);
  const rise = clamp((typeof spec.rise === 'number') ? spec.rise : 1.0, -1, 2);
  const arc = clamp((typeof spec.arc === 'number') ? spec.arc : 0.0, 0, 1); // 0..1 widens sideways drift and adds curvature
  const reduceMotion = !!spec.reduceMotion;
  const seed = (spec.seed == null) ? null : Number(spec.seed);

  // Scale and overshoot mapping (size controls both)
  const baseScale = 1.0 + (size - 1.0) * 0.4; // gentle size mapping
  const overshoot = (reduceMotion ? 0.05 : 0.15) + size * (reduceMotion ? 0.02 : 0.08);
  // Allow explicit scaleStart/End to override the default overshoot-shrink behavior
  const scaleStart = (spec.scaleStart !== undefined) ? spec.scaleStart : (baseScale + overshoot);
  const scaleEnd   = (spec.scaleEnd   !== undefined) ? spec.scaleEnd   : (baseScale);

  // Motion mapping (energy controls aggression: speed, jitter)
  const r = rand01(world, seed);
  const speed = reduceMotion ? 0.05 : lerp(0.08, 0.9, energy);
  // Angle range widens with arc, but allow explicit override via spec.angleRange (in PI units)
  const angleRangePi = (spec.angleRange != null) ? clamp(spec.angleRange, 0, 1.2) : lerp(0.3, 1.0, arc);
  const angle = (r() * Math.PI * angleRangePi) - (Math.PI * angleRangePi * 0.5);
  let vx = Math.cos(angle) * speed * 0.5 * (r() * 0.6 + 0.7);
  let vy = -Math.abs(Math.sin(angle) * speed) - (0.25 + energy * 0.55) * rise;
  if (reduceMotion){ vx *= 0.3; vy *= 0.3; }
  // Upward acceleration to maintain drift; small drag tuned by energy
  // Add slight sideways curvature proportional to arc and sign of initial angle.
  // Allow explicit override: spec.arcCurvature for magnitude, spec.arcDir for direction (-1|+1)
  const sideSign = (spec.arcDir === -1 || spec.arcDir === 1)
    ? spec.arcDir
    : (angle === 0 ? (r() < 0.5 ? -1 : 1) : Math.sign(angle));
  const curvature = (typeof spec.arcCurvature === 'number') ? clamp(spec.arcCurvature, 0, 0.3) : (arc * 0.06);
  const ax = (reduceMotion ? 0 : sideSign * curvature);
  const ay = -(0.10 + 0.20 * rise) * (reduceMotion ? 0.3 : 1.0);
  const dragPerFrame = reduceMotion ? 0.995 : (0.992 - energy * 0.02);

  // Jitter parameters for renderer-side readable motion
  const jitterAmpPx = (spec.jitterAmpPx !== undefined)
    ? Math.max(0, Number(spec.jitterAmpPx) || 0)
    : (reduceMotion ? 0 : (energy * 4 * (0.8 + size * 0.4)));
  const j = seededJitter(seed, r);

  world.add(e, Effect, {
    type: 'float_text',
    ttl: life,
    ttlMax: life,
    pos: { x, y },
    data: {
      text,
      color,
      vx, vy, ax, ay,
      dragPerFrame,
      scaleStart,
      scaleEnd,
      jitterAmpPx,
      jitter: j,
      justSpawned: true
    },
    layer: spec.layer || 'top',
    priority: spec.priority || 0
  });
  return e;
}

function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
function lerp(a, b, t){ return a + (b - a) * t; }
function rand01(world, seed){
  if (seed == null){
    const f = (typeof world.rand === 'function') ? world.rand.bind(world) : Math.random;
    return () => f();
  }
  // Deterministic PRNG (LCG)
  let s = (seed >>> 0) || 1;
  return () => { s = (1664525 * s + 1013904223) >>> 0; return (s & 0xfffffff) / 0xfffffff; };
}
function seededJitter(seed, r){
  const rand = r || (() => Math.random());
  const phaseX = rand() * Math.PI * 2;
  const phaseY = rand() * Math.PI * 2;
  const freqX = 3 + rand() * 3; // 3..6 Hz relative to life progression
  const freqY = 2 + rand() * 2; // 2..4 Hz
  return { phaseX, phaseY, freqX, freqY };
}

// Spawn a particle burst using the particle system attached to world.
export function spawnParticleBurst(world, opts = {}){
  // Ensure a particle system exists attached to the shared RenderContext
  const rc = getRenderContext(world);
  if (!rc){
    // If no RenderContext yet (very early startup), drop the burst silently.
    // We require the RenderContext to host the particle pool to keep runtime state in ECS.
    return;
  } else {
    // RenderContext should have a particleSystem created at startup; if missing, create here.
    if (!rc.particleSystem){
      const rcId = world.renderContextId;
      const ps = createParticleSystem({ poolSize: 512 });
      try{
        const rcRec = (rcId && world.getInstance) ? (world.getInstance(rcId, RenderContext) || world.get(rcId, RenderContext)) : rc;
        if (rcRec){ rcRec.particleSystem = ps; world.markChanged(rcId, RenderContext); }
        else { rc.particleSystem = ps; }
      }catch(e){ rc.particleSystem = ps; }
    }
  }
  // opts should include world coordinates x,y and other params
  const x = opts.x || 0;
  const y = opts.y || 0;
  // Cap burst size to avoid accidental huge bursts causing memory spikes
  const requestedCount = opts.count || 10;
  const MAX_BURST = 256;
  const count = Math.min(requestedCount, MAX_BURST);
  const speed = opts.speed || 0.7;
  const spread = opts.spread !== undefined ? opts.spread : Math.PI * 2;
  const life = opts.life || 0.8;
  const color = opts.color || '#ffffff';
  const size = opts.size || 1;
  const sizeEnd = opts.sizeEnd !== undefined ? opts.sizeEnd : 0.25;
  // prefer particle system on RenderContext
  const rc2 = getRenderContext(world);
  const pool = (rc2 && rc2.particleSystem) ? rc2.particleSystem : null;
  if (!pool) return;
  pool.spawnBurst({
    x, y, count, spread, speed, life, color, size, sizeEnd,
    vx: opts.vx, vy: opts.vy, ax: opts.ax, ay: opts.ay
  });
}
