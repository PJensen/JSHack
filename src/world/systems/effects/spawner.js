import { Effect } from '../../components/Effect.js';
import { createParticleSystem } from './particleSystem.js';
import { getRenderContext } from '../renderers/renderingUtils.js';
import { RenderContext } from '../../components/RenderContext.js';

// Convenience helper to spawn common effects
export function spawnFloatText(world, x, y, text, opts={}){
  // Safety caps to avoid unbounded effect entity creation (OOM)
  const MAX_FLOAT_TEXT = 512; // max simultaneous float text effects
  const MAX_TOTAL_EFFECTS = 2048; // safety cap for all effects
  try{
    const activeFloat = world.query(Effect, { where: (eff) => eff && eff.type === 'float_text' }).count();
    if (activeFloat >= MAX_FLOAT_TEXT){
      // drop low-priority float texts when we're at capacity
      if (opts && opts.batch) return null;
      // otherwise skip silently
      return null;
    }
    const totalEff = world.query(Effect).count();
    if (totalEff >= MAX_TOTAL_EFFECTS){
      // avoid creating more global effects when we're overloaded
      return null;
    }
  } catch(e){ /* if counting fails, fall through and attempt to spawn */ }

  const e = world.create();
  const life = opts.life || 0.9;
  const scaleBase = opts.crit ? 1.3 : 1.0;
  const dmg = opts.dmg || 0;
  const magScale = dmg ? Math.min(2.2, 0.7 + dmg / 10) : 1;
  const scaleStart = opts.scaleStart || (scaleBase * magScale);
  const scaleEnd = opts.scaleEnd || (0.75 * scaleBase);
  world.add(e, Effect, {
    type: 'float_text',
    ttl: life,
    ttlMax: life,
    pos: { x, y },
    data: {
      text: String(text),
      color: opts.color || '#ffffff',
      vx: opts.vx || (Math.random()*0.4 - 0.2),
      vy: opts.vy || (-0.8 - Math.random()*0.3),
      scaleStart,
      scaleEnd,
      batch: opts.batch || false,
      value: (/^[-+]?\d+$/.test(String(text)) ? parseInt(text,10) : null),
      sign: (String(text).startsWith('-')? -1 : 1),
      justSpawned: true
    },
    layer: opts.layer || 'top',
    priority: opts.priority || 0
  });
  return e;
}

// Spawn a particle burst using the particle system attached to world.
export function spawnParticleBurst(world, opts = {}){
  // Ensure a particle system exists attached to the shared RenderContext
  const rc = getRenderContext(world);
  if (!rc){
    // If no RenderContext yet (very early startup), drop the burst and warn.
    // We require the RenderContext to host the particle pool to keep runtime state in ECS.
    console.warn('spawnParticleBurst: RenderContext not ready — skipping particle burst');
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
