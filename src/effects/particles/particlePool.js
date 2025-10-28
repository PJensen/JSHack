// Pooled Particle Array System
// High-performance particle system using object pools and typed arrays
// Particles are NOT ECS entities to avoid memory/performance overhead

const DEFAULT_POOL_SIZE = 2048;
const DEFAULT_MAX_SIZE = 4096;

// Particle structure (plain object, not an ECS entity)
const createParticle = () => ({
  // Position
  x: 0,
  y: 0,
  // Velocity
  vx: 0,
  vy: 0,
  // Acceleration
  ax: 0,
  ay: 0,
  // Lifetime
  life: 0,
  lifeMax: 1,
  // Visual properties
  size: 1,
  sizeEnd: 0.5,
  color: '#ffffff',
  alpha: 1.0,
  // Rotation (optional)
  rotation: 0,
  rotationSpeed: 0,
  // State
  alive: false,
  // Type/tag for behavior variants
  type: 'default',
  // Custom data payload
  data: null,
  
  // Reset method for pool recycling
  reset() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.ax = 0;
    this.ay = 0;
    this.life = 0;
    this.lifeMax = 1;
    this.size = 1;
    this.sizeEnd = 0.5;
    this.color = '#ffffff';
    this.alpha = 1.0;
    this.rotation = 0;
    this.rotationSpeed = 0;
    this.alive = false;
    this.type = 'default';
    this.data = null;
  }
});

/**
 * Create a pooled particle system
 * @param {Object} options Configuration
 * @param {number} options.initialSize Initial pool size
 * @param {number} options.maxSize Maximum pool size (hard cap)
 * @param {number} options.gravity Default gravity acceleration
 * @returns {Object} Particle system interface
 */
export function createParticlePool(options = {}) {
  const initialSize = options.initialSize || DEFAULT_POOL_SIZE;
  const maxSize = options.maxSize || DEFAULT_MAX_SIZE;
  const defaultGravity = options.gravity !== undefined ? options.gravity : 0.0;
  
  // Pool storage
  const freeList = [];
  const activeParticles = [];
  let totalAllocated = 0;
  
  // Pre-allocate initial pool
  for (let i = 0; i < initialSize; i++) {
    const p = createParticle();
    freeList.push(p);
    totalAllocated++;
  }
  
  /**
   * Allocate a particle from the pool
   * @returns {Object|null} Particle object or null if pool exhausted
   */
  function allocate() {
    let particle;
    
    if (freeList.length > 0) {
      particle = freeList.pop();
    } else if (totalAllocated < maxSize) {
      particle = createParticle();
      totalAllocated++;
    } else {
      // Pool exhausted - return null to signal caller
      return null;
    }
    
    particle.alive = true;
    activeParticles.push(particle);
    return particle;
  }
  
  /**
   * Release a particle back to the pool
   * @param {Object} particle The particle to release
   */
  function release(particle) {
    particle.reset();
    freeList.push(particle);
  }
  
  /**
   * Spawn a single particle with specified properties
   * @param {Object} props Particle properties
   * @returns {Object|null} The spawned particle or null if pool exhausted
   */
  function spawn(props = {}) {
    const p = allocate();
    if (!p) return null;
    
    // Apply properties
    if (props.x !== undefined) p.x = props.x;
    if (props.y !== undefined) p.y = props.y;
    if (props.vx !== undefined) p.vx = props.vx;
    if (props.vy !== undefined) p.vy = props.vy;
    if (props.ax !== undefined) p.ax = props.ax;
    if (props.ay !== undefined) p.ay = props.ay; else p.ay = defaultGravity;
    if (props.life !== undefined) {
      p.life = props.life;
      p.lifeMax = props.life;
    }
    if (props.size !== undefined) p.size = props.size;
    if (props.sizeEnd !== undefined) p.sizeEnd = props.sizeEnd;
    if (props.color !== undefined) p.color = props.color;
    if (props.alpha !== undefined) p.alpha = props.alpha;
    if (props.rotation !== undefined) p.rotation = props.rotation;
    if (props.rotationSpeed !== undefined) p.rotationSpeed = props.rotationSpeed;
    if (props.type !== undefined) p.type = props.type;
    if (props.data !== undefined) p.data = props.data;
    
    return p;
  }
  
  /**
   * Spawn a burst of particles
   * @param {Object} opts Burst configuration
   */
  function spawnBurst(opts = {}) {
    const count = opts.count || 8;
    const x = opts.x || 0;
    const y = opts.y || 0;
    const spread = opts.spread !== undefined ? opts.spread : Math.PI * 2;
    const angle = opts.angle || 0;
    const speed = opts.speed || 0.6;
    const speedVariance = opts.speedVariance !== undefined ? opts.speedVariance : 0.4;
    const life = opts.life || 0.8;
    const lifeVariance = opts.lifeVariance || 0.2;
    const size = opts.size || 1.0;
    const sizeEnd = opts.sizeEnd !== undefined ? opts.sizeEnd : 0.25;
    const color = opts.color || '#ffffff';
    const vx = opts.vx || 0;
    const vy = opts.vy || 0;
    const ax = opts.ax || 0;
    const ay = opts.ay !== undefined ? opts.ay : defaultGravity;
    
    // Limit burst to available capacity
    const available = maxSize - activeParticles.length;
    const spawnCount = Math.min(count, available);
    
    for (let i = 0; i < spawnCount; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const s = speed * (1.0 - speedVariance * 0.5 + Math.random() * speedVariance);
      const l = life * (1.0 - lifeVariance * 0.5 + Math.random() * lifeVariance);
      
      spawn({
        x,
        y,
        vx: Math.cos(a) * s + vx,
        vy: Math.sin(a) * s + vy,
        ax,
        ay,
        life: l,
        size,
        sizeEnd,
        color,
        type: opts.type || 'burst'
      });
    }
    
    return spawnCount;
  }
  
  /**
   * Update all active particles
   * @param {number} dt Delta time in seconds
   */
  function update(dt) {
    // Iterate backwards for safe removal
    for (let i = activeParticles.length - 1; i >= 0; i--) {
      const p = activeParticles[i];
      
      if (!p.alive) {
        activeParticles.splice(i, 1);
        release(p);
        continue;
      }
      
      // Update velocity
      p.vx += p.ax * dt;
      p.vy += p.ay * dt;
      
      // Update position
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      
      // Update rotation
      if (p.rotationSpeed !== 0) {
        p.rotation += p.rotationSpeed * dt;
      }
      
      // Update lifetime
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        activeParticles.splice(i, 1);
        release(p);
      }
    }
  }
  
  /**
   * Iterate over all active particles
   * @param {Function} fn Callback function(particle, index)
   */
  function forEach(fn) {
    for (let i = 0; i < activeParticles.length; i++) {
      fn(activeParticles[i], i);
    }
  }
  
  /**
   * Clear all active particles (return to pool)
   */
  function clear() {
    for (let i = activeParticles.length - 1; i >= 0; i--) {
      const p = activeParticles[i];
      p.alive = false;
      release(p);
    }
    activeParticles.length = 0;
  }
  
  /**
   * Trim the free list to reduce memory usage
   * @param {number} reserve Number of particles to keep in free list
   * @returns {number} Number of particles removed
   */
  function trim(reserve = 256) {
    let removed = 0;
    while (freeList.length > reserve) {
      freeList.pop();
      totalAllocated--;
      removed++;
    }
    return removed;
  }
  
  /**
   * Get particle system statistics
   * @returns {Object} Stats object
   */
  function getStats() {
    return {
      active: activeParticles.length,
      free: freeList.length,
      total: totalAllocated,
      max: maxSize,
      utilization: (activeParticles.length / maxSize * 100).toFixed(1) + '%'
    };
  }
  
  // Return public interface
  return {
    spawn,
    spawnBurst,
    update,
    forEach,
    clear,
    trim,
    getStats,
    
    // Getters
    get count() { return activeParticles.length; },
    get capacity() { return maxSize; },
    get available() { return maxSize - activeParticles.length; },
    
    // Advanced access (use with caution)
    _particles: activeParticles,
    _freeList: freeList
  };
}

// Default global instance (lazy-initialized)
let globalParticlePool = null;

/**
 * Get or create the global particle pool
 * @returns {Object} Global particle pool instance
 */
export function getGlobalParticlePool() {
  if (!globalParticlePool) {
    globalParticlePool = createParticlePool({
      initialSize: DEFAULT_POOL_SIZE,
      maxSize: DEFAULT_MAX_SIZE,
      gravity: 0.0
    });
  }
  return globalParticlePool;
}

/**
 * Reset the global particle pool (useful for cleanup/testing)
 */
export function resetGlobalParticlePool() {
  if (globalParticlePool) {
    globalParticlePool.clear();
  }
  globalParticlePool = null;
}
