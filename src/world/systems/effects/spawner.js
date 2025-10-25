import { Effect } from '../../components/Effect.js';
import { createParticleSystem } from './particleSystem.js';
import { getRenderContext } from '../render/utils.js';
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
  const scaleBase = (opts.scaleBase !== undefined) ? opts.scaleBase : (opts.crit ? 1.3 : 1.0);
  const dmg = (typeof opts.dmg === 'number' && isFinite(opts.dmg)) ? Math.max(0, opts.dmg) : 0;
  const dmgScaleBase = (opts.dmgScaleBase !== undefined) ? opts.dmgScaleBase : 0.7;
  const dmgScalePer  = (opts.dmgScalePer  !== undefined) ? opts.dmgScalePer  : (1/10);
  const dmgScaleMax  = (opts.dmgScaleMax  !== undefined) ? opts.dmgScaleMax  : 2.2;
  const magScale = dmg ? Math.min(dmgScaleMax, dmgScaleBase + (dmg * dmgScalePer)) : 1;
  const scaleStart = (opts.scaleStart !== undefined) ? opts.scaleStart : (scaleBase * magScale);
  const scaleEnd   = (opts.scaleEnd   !== undefined) ? opts.scaleEnd   : (0.75 * scaleBase);
  // Compute initial motion
  const rng = (typeof world.rand === 'function') ? world.rand.bind(world) : Math.random;
  let vx = 0, vy = 0;
  if (typeof opts.vx === 'number' || typeof opts.vy === 'number'){
    vx = opts.vx || 0; vy = opts.vy || 0;
  } else {
    const preset = (opts.motionPreset || (opts.motion && opts.motion.preset)) || (dmg > 0 ? 'damage' : 'gentle');
    if (preset === 'damage'){
      const angleCenterRad = (opts.angleCenterRad ?? opts.motion?.angleCenterRad ?? (-Math.PI/2));
      const angleSpreadRad = (opts.angleSpreadRad ?? opts.motion?.angleSpreadRad ?? (Math.PI/3));
      const speedBase      = (opts.speedBase      ?? opts.motion?.speedBase      ?? 0.6);
      const speedPerSqrtDmg= (opts.speedPerSqrtDmg?? opts.motion?.speedPerSqrtDmg?? 0.18);
      const speedMax       = (opts.speedMax       ?? opts.motion?.speedMax       ?? 3.0);
      const angle = angleCenterRad + ((rng()*2 - 1) * angleSpreadRad);
      const speed = Math.max(0, Math.min(speedMax, speedBase + Math.sqrt(dmg) * speedPerSqrtDmg));
      vx = Math.cos(angle) * speed;
      vy = Math.sin(angle) * speed;
    } else {
      const gentleVxMin  = (opts.gentleVxMin  ?? opts.motion?.gentleVxMin  ?? -0.2);
      const gentleVxMax  = (opts.gentleVxMax  ?? opts.motion?.gentleVxMax  ?? 0.2);
      const gentleVyBase = (opts.gentleVyBase ?? opts.motion?.gentleVyBase ?? -0.8);
      const gentleVyJitter=(opts.gentleVyJitter?? opts.motion?.gentleVyJitter?? 0.3);
      vx = (rng() * (gentleVxMax - gentleVxMin)) + gentleVxMin;
      vy = (gentleVyBase - (rng() * gentleVyJitter));
    }
  }
  const ax = (opts.ax ?? opts.motion?.ax ?? 0);
  const ay = (opts.ay ?? opts.motion?.ay ?? -0.45);
  const dragPerFrame = (opts.dragPerFrame ?? opts.motion?.dragPerFrame);
  world.add(e, Effect, {
    type: 'float_text',
    ttl: life,
    ttlMax: life,
    pos: { x, y },
    data: {
      text: String(text),
      color: opts.color || '#ffffff',
  vx,
  vy,
  ax,
  ay,
  ...(typeof dragPerFrame === 'number' ? { dragPerFrame } : {}),
  motionPreset: (opts.motionPreset || opts.motion?.preset) || (dmg > 0 ? 'damage' : 'gentle'),
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
