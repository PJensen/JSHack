import { getGlobalParticlePool } from './particlePool.js';

// (float text helper removed until an Effect component exists in this repo)

/**
 * Spawn a particle using the pooled particle system (not an ECS entity)
 * @param {Object} world World instance (for accessing global particle pool)
 * @param {Object} props Particle properties
 * @returns {Object|null} Spawned particle or null if pool exhausted
 */
export function spawnParticle(world, props) {
  const pool = getGlobalParticlePool();
  return pool.spawn(props);
}

/**
 * Spawn a burst of particles
 * @param {Object} world World instance
 * @param {Object} opts Burst configuration (x, y, count, spread, speed, etc.)
 * @returns {number} Number of particles spawned
 */
export function spawnParticleBurst(world, opts) {
  const pool = getGlobalParticlePool();
  return pool.spawnBurst(opts);
}

/**
 * Spawn common hit/impact particles at a location
 * @param {Object} world World instance
 * @param {number} x X position
 * @param {number} y Y position
 * @param {Object} opts Options (color, count, etc.)
 */
export function spawnHitParticles(world, x, y, opts = {}) {
  return spawnParticleBurst(world, {
    x,
    y,
    count: opts.count || 8,
    spread: Math.PI * 2,
    speed: opts.speed || 1.2,
    speedVariance: 0.5,
    life: opts.life || 0.4,
    lifeVariance: 0.3,
    size: opts.size || 0.8,
    sizeEnd: 0.1,
    color: opts.color || '#ff6b6b',
    ay: opts.gravity !== undefined ? opts.gravity : -0.5,
    type: 'hit'
  });
}

/**
 * Spawn death/explosion particles
 * @param {Object} world World instance
 * @param {number} x X position
 * @param {number} y Y position
 * @param {Object} opts Options
 */
export function spawnDeathParticles(world, x, y, opts = {}) {
  return spawnParticleBurst(world, {
    x,
    y,
    count: opts.count || 16,
    spread: Math.PI * 2,
    speed: opts.speed || 2.0,
    speedVariance: 0.6,
    life: opts.life || 0.8,
    lifeVariance: 0.4,
    size: opts.size || 1.2,
    sizeEnd: 0.2,
    color: opts.color || '#888888',
    ay: opts.gravity !== undefined ? opts.gravity : -1.0,
    type: 'death'
  });
}

/**
 * Spawn magical/spell particles
 * @param {Object} world World instance
 * @param {number} x X position
 * @param {number} y Y position
 * @param {Object} opts Options
 */
export function spawnMagicParticles(world, x, y, opts = {}) {
  return spawnParticleBurst(world, {
    x,
    y,
    count: opts.count || 12,
    spread: opts.spread !== undefined ? opts.spread : Math.PI * 2,
    angle: opts.angle || 0,
    speed: opts.speed || 0.8,
    speedVariance: 0.5,
    life: opts.life || 1.0,
    lifeVariance: 0.3,
    size: opts.size || 0.6,
    sizeEnd: 0.1,
    color: opts.color || '#4da6ff',
    ay: opts.gravity !== undefined ? opts.gravity : 0.2,
    type: 'magic'
  });
}

// ---------------------------------------------------------------------------
// Emitter component and systems (ECS-driven, pooled-particle backend)

/**
 * Emitter component (ECS) — drives pooled particle spawning without making
 * particles themselves ECS entities.
 *
 * Notes:
 * - continuous=true spawns at a steady rate (particles/sec)
 * - burstCount>0 triggers an immediate burst when enabled; if continuous=false
 *   the emitter disables itself after the one-time burst (good for impacts)
 */
// Emitter component now lives in src/components/Emitter.js

/**
 * Factory: create an update system that processes all entities with (Position, Emitter).
 * NOTE: We accept the Component references via injection to guarantee referential identity
 * across module boundaries (important for world.query component matching).
 *
 * Example:
 *   const EmitterSystem = createEmitterSystem({ Position, Emitter });
 *   registerSystem(EmitterSystem, 'update');
 */
export function createEmitterSystem({ Position, Emitter }) {
  const pool = getGlobalParticlePool();

  return function emitterSystem(world, dt) {
    // dt is in seconds (real-time FX clock). Use directly for rates/lifetimes.
    if (!dt || dt <= 0) return;
    for (const [id, pos, em] of world.query(Position, Emitter)) {
      if (!em.enabled) continue;

      // Immediate burst on first enable
      if (em.burstCount > 0 && !em._didBurst) {
        pool.spawnBurst({
          x: pos.x + (em.offsetX || 0),
          y: pos.y + (em.offsetY || 0),
          count: em.burstCount,
          angle: em.angle,
          spread: em.spread,
          speed: em.speed,
          speedVariance: Math.max(0, Math.min(1, em.speedJitter)),
          life: em.life,
          lifeVariance: Math.max(0, Math.min(1, em.lifeJitter)),
          size: em.size,
          sizeEnd: em.sizeEnd,
          color: em.color,
          vx: em.vx,
          vy: em.vy,
          ax: em.ax,
          ay: em.ay
        });
        em._didBurst = true;
        if (!em.continuous) {
          em.enabled = false; // one-shot
          continue;
        }
      }

      // Continuous emission
      if (em.continuous && em.rate > 0) {
        // Accumulate particles-per-second against elapsed seconds
        em._acc += dt * em.rate; // particles accrued
        const quota = em._acc | 0; // integer particles to spawn
        if (quota > 0) {
          em._acc -= quota;
          const x = pos.x + (em.offsetX || 0);
          const y = pos.y + (em.offsetY || 0);
          for (let i = 0; i < quota; i++) {
            // Jitter speed and life
            const sj = Math.max(0, Math.min(1, em.speedJitter));
            const lj = Math.max(0, Math.min(1, em.lifeJitter));
            const s = em.speed * (1.0 - sj * 0.5 + Math.random() * sj);
            const l = em.life * (1.0 - lj * 0.5 + Math.random() * lj);
            const a = em.angle + (Math.random() - 0.5) * em.spread;
            pool.spawn({
              x,
              y,
              vx: Math.cos(a) * s + (em.vx || 0),
              vy: Math.sin(a) * s + (em.vy || 0),
              ax: em.ax,
              ay: em.ay,
              life: l,
              size: em.size,
              sizeEnd: em.sizeEnd,
              color: em.color,
              type: 'emitter'
            });
          }
        }
      }
    }
  };
}

/**
 * System: advance pooled particles (physics/lifetime).
 * Register under your 'update' phase.
 */
export function particlePoolUpdateSystem(world, dt) {
  const pool = getGlobalParticlePool();
  // dt is in seconds (real-time FX clock)
  pool.update(dt);
}

/**
 * System: render pooled particles to the world's canvas context.
 * Assumes world.ctx is a 2D canvas context, and that caller provides an
 * optional origin (cx, cy) to convert world coords -> screen.
 */
export function renderPooledParticlesSystem(world, _dt, opts = {}) {
  const ctx = world.ctx;
  if (!ctx) return;
  const cx = opts.cx ?? 0;
  const cy = opts.cy ?? 0;
  const pool = getGlobalParticlePool();

  ctx.save();
  ctx.globalCompositeOperation = opts.mode || 'lighter';
  pool.forEach((p) => {
    const a = Math.max(0, p.life / (p.lifeMax || p.life || 1));
    ctx.fillStyle = hexToRgba(p.color || '#8cf', (opts.alphaScale ?? 0.9) * a);
    ctx.beginPath();
    ctx.arc(cx + p.x, cy + p.y, p.size * (0.5 + 0.6 * a), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

// local helper duplicated here to avoid coupling
function hexToRgba(hex, a = 1) {
  const h = String(hex).replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}
