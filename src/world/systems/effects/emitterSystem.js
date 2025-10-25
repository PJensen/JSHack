// emitterSystem.js
// Spawns particles from entities with Position + Emitter using the shared particle pool.
// Particles are pooled objects, not ECS entities.
import { Position } from '../../components/Position.js';
import { Emitter } from '../../components/Emitter.js';
import { getRenderContext } from '../render/utils.js';

export function emitterSystem(world, dt){
  const rc = getRenderContext(world);
  if (!rc || !rc.particleSystem) return;
  const ps = rc.particleSystem;
  const rand = (typeof world.rand === 'function') ? world.rand : Math.random;

  // Cap total spawns per system step to protect the pool
  const GLOBAL_MAX_SPAWN = 256;
  let spawnedTotal = 0;

  for (const [id, pos, em] of world.query(Position, Emitter)){
    if (!em || !em.enabled) continue;

    // One-shot burst
    if (!em._didBurst && em.burstCount > 0){
      const count = Math.max(0, em.burstCount|0);
      const n = Math.min(count, Math.max(0, GLOBAL_MAX_SPAWN - spawnedTotal));
      if (n > 0){
        // spawn n with directional fan
        for (let i=0;i<n;i++){
          const jitter = (rand()*2 - 1) * (em.spread || 0);
          const ang = (em.angle || 0) + jitter;
          const sJ = Math.max(0, 1 + (rand()*2 - 1) * (em.speedJitter || 0));
          const spd = Math.max(0, (em.speed || 0.6) * sJ);
          const lifeJ = Math.max(0, 1 + (rand()*2 - 1) * (em.lifeJitter || 0));
          const life = Math.max(0.05, (em.life || 0.8) * lifeJ);
          ps.spawnParticle({
            x: (pos.x || 0) + (em.offsetX || 0),
            y: (pos.y || 0) + (em.offsetY || 0),
            vx: Math.cos(ang) * spd + (em.vx || 0),
            vy: Math.sin(ang) * spd + (em.vy || 0),
            ax: em.ax || 0,
            ay: (em.ay !== undefined ? em.ay : -0.6),
            life: life,
            lifeMax: life,
            size: em.size || 1,
            sizeEnd: (em.sizeEnd !== undefined ? em.sizeEnd : 0.25),
            color: em.color || '#ffffff'
          });
        }
        spawnedTotal += n;
      }
      em._didBurst = true;
    }

    if (!em.continuous) continue;

    // Accumulate fractional spawns by rate
    const rate = Math.max(0, em.rate || 0);
    em._acc = (em._acc || 0) + rate * dt;
    let n = em._acc | 0;
    if (n <= 0) continue;
    em._acc -= n;

    // Guardrails: cap per-emitter per-frame spawns and global total
    const PER_EMITTER_MAX = 32;
    n = Math.min(n, PER_EMITTER_MAX, Math.max(0, GLOBAL_MAX_SPAWN - spawnedTotal));
    if (n <= 0) continue;

    for (let i=0;i<n;i++){
      const jitter = (rand()*2 - 1) * (em.spread || 0);
      const ang = (em.angle || 0) + jitter;
      const sJ = Math.max(0, 1 + (rand()*2 - 1) * (em.speedJitter || 0));
      const spd = Math.max(0, (em.speed || 0.6) * sJ);
      const lifeJ = Math.max(0, 1 + (rand()*2 - 1) * (em.lifeJitter || 0));
      const life = Math.max(0.05, (em.life || 0.8) * lifeJ);
      ps.spawnParticle({
        x: (pos.x || 0) + (em.offsetX || 0),
        y: (pos.y || 0) + (em.offsetY || 0),
        vx: Math.cos(ang) * spd + (em.vx || 0),
        vy: Math.sin(ang) * spd + (em.vy || 0),
        ax: em.ax || 0,
        ay: (em.ay !== undefined ? em.ay : -0.6),
        life: life,
        lifeMax: life,
        size: em.size || 1,
        sizeEnd: (em.sizeEnd !== undefined ? em.sizeEnd : 0.25),
        color: em.color || '#ffffff'
      });
    }
    spawnedTotal += n;
  }
}
