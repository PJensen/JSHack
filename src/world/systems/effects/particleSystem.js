import { createSimplePool } from './effectPool.js';

// Default particle shape
const DEFAULT_PARTICLE = {
  x: 0, y: 0,
  vx: 0, vy: 0,
  ax: 0, ay: 0,
  life: 0, lifeMax: 1,
  size: 1, sizeEnd: 1,
  color: '#ffffff',
  alive: false,
};

export function createParticleSystem(options = {}){
  const poolSize = options.poolSize || 512;
  const pool = createSimplePool(DEFAULT_PARTICLE, poolSize, poolSize);

  // active particles array
  const particles = [];

  function spawnParticle(p){
    const part = pool.allocate();
    if (!part) {
      // Pool exhausted — skip spawning to avoid unbounded memory growth.
      return null;
    }
    // copy properties onto pooled object
    for (const k in DEFAULT_PARTICLE){
      if (p[k] !== undefined) part[k] = p[k];
      else part[k] = DEFAULT_PARTICLE[k];
    }
    part.alive = true;
    particles.push(part);
    return part;
  }

  function spawnBurst(opts){
    // opts: x,y,count,spread,speed,life,color,size
    const count = opts.count || 8;
    const spread = opts.spread || Math.PI * 2;
    const angle0 = opts.angle || 0;
    const speed = opts.speed || 0.6;
    const life = opts.life || 0.8;
    const color = opts.color || '#ffffff';
    const size = opts.size || 1;
    const sizeEnd = opts.sizeEnd !== undefined ? opts.sizeEnd : 0.25;
  // Bound the burst to available pool capacity to avoid trying to allocate
  // more particles than the pool allows.
  const maxSpawn = Math.max(0, pool.maxSize ? (pool.maxSize - pool.totalAllocated()) : count);
  const spawnLimit = Math.min(count, Math.max(1, maxSpawn || count));
  for (let i=0;i<spawnLimit;i++){
      const a = angle0 + (Math.random()-0.5) * spread;
      const s = speed * (0.6 + Math.random()*0.8);
      spawnParticle({
        x: opts.x || 0,
        y: opts.y || 0,
        vx: Math.cos(a) * s + (opts.vx||0),
        vy: Math.sin(a) * s + (opts.vy||0),
        ax: opts.ax || 0,
        ay: opts.ay !== undefined ? opts.ay : (opts.gravity || -0.02),
        life: life,
        lifeMax: life,
        size: size,
        sizeEnd: sizeEnd,
        color: color
      });
    }
  }

  function update(dt){
    // dt in seconds
    // iterate backwards and remove dead
    for (let i = particles.length - 1; i >= 0; i--){
      const p = particles[i];
  if (!p.alive) { particles.splice(i,1); pool.release(p); continue; }
      p.vx += (p.ax || 0) * dt;
      p.vy += (p.ay || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0){
        p.alive = false;
        particles.splice(i,1);
        pool.release(p);
      }
    }
  }

  function forEach(fn){
    for (let i=0;i<particles.length;i++) fn(particles[i], i);
  }

  function count(){ return particles.length; }

  function capacity(){
    return { poolSize: pool.maxSize || null, allocated: pool.totalAllocated ? pool.totalAllocated() : null };
  }

  return {
    spawnParticle, spawnBurst, update, forEach, count, _pool: pool
    , capacity
  };
}
