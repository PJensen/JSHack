import { Effect } from '../components/Effect.js';
import { getGlobalParticlePool } from './particlePool.js';

// Convenience helper to spawn common effects
export function spawnFloatText(world, x, y, text, opts={}){
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
