// Pooled Particle System Usage Examples
// Demonstrates how to use the high-performance pooled particle array

import { 
  createParticlePool, 
  getGlobalParticlePool, 
  resetGlobalParticlePool 
} from './particlePool.js';

import {
  spawnParticle,
  spawnParticleBurst,
  spawnHitParticles,
  spawnDeathParticles,
  spawnMagicParticles
} from './spawner.js';

// ============================================================================
// Example 1: Using the Global Particle Pool
// ============================================================================

function exampleGlobalPool(world) {
  // Get the global pool (automatically created on first access)
  const pool = getGlobalParticlePool();
  
  // Check pool stats
  console.log('Pool stats:', pool.getStats());
  // Output: { active: 0, free: 2048, total: 2048, max: 4096, utilization: '0.0%' }
  
  // Spawn a single particle
  const particle = pool.spawn({
    x: 10,
    y: 5,
    vx: 1.0,
    vy: -0.5,
    life: 2.0,
    color: '#ff0000',
    size: 1.5
  });
  
  if (!particle) {
    console.warn('Pool exhausted! Cannot spawn particle.');
    return;
  }
  
  console.log('Spawned particle at', particle.x, particle.y);
}

// ============================================================================
// Example 2: Using Convenience Spawners
// ============================================================================

function exampleConvenienceSpawners(world) {
  // Spawn a particle using the spawner helper
  spawnParticle(world, {
    x: 15,
    y: 10,
    vx: 0.5,
    vy: -1.0,
    life: 1.5,
    color: '#00ff00',
    size: 1.0,
    sizeEnd: 0.2,
    ay: -0.5 // gravity
  });
  
  // Spawn a particle burst
  const count = spawnParticleBurst(world, {
    x: 20,
    y: 15,
    count: 16,
    spread: Math.PI * 2, // 360 degrees
    speed: 2.0,
    life: 0.8,
    color: '#0000ff'
  });
  
  console.log(`Spawned ${count} particles in burst`);
  
  // Spawn hit effect particles
  spawnHitParticles(world, 25, 20, {
    color: '#ff6b6b',
    count: 8
  });
  
  // Spawn death explosion
  spawnDeathParticles(world, 30, 25, {
    color: '#888888',
    count: 20
  });
  
  // Spawn magic effect
  spawnMagicParticles(world, 35, 30, {
    color: '#4da6ff',
    count: 12,
    spread: Math.PI / 4, // Narrow cone
    angle: -Math.PI / 2 // Upward
  });
}

// ============================================================================
// Example 3: Creating a Custom Particle Pool
// ============================================================================

function exampleCustomPool() {
  // Create a dedicated pool for a specific effect type
  const fireParticlePool = createParticlePool({
    initialSize: 512,  // Start with 512 particles pre-allocated
    maxSize: 1024,     // Hard cap at 1024 particles
    gravity: -0.8      // Default upward gravity for fire
  });
  
  // Spawn fire particles
  for (let i = 0; i < 20; i++) {
    fireParticlePool.spawn({
      x: 40 + Math.random() * 2,
      y: 35,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -1.5 - Math.random() * 0.5,
      life: 0.5 + Math.random() * 0.3,
      color: i % 2 === 0 ? '#ff4500' : '#ffa500',
      size: 0.8 + Math.random() * 0.4,
      sizeEnd: 0.1
    });
  }
  
  // Update the pool (call this every frame)
  const dt = 1/60; // 60 FPS
  fireParticlePool.update(dt);
  
  // Render the particles
  fireParticlePool.forEach(p => {
    console.log(`Fire particle at (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
  });
  
  // Clean up
  fireParticlePool.clear(); // Remove all active particles
  fireParticlePool.trim(128); // Trim free list to 128 particles
}

// ============================================================================
// Example 4: Integration with ECS World
// ============================================================================

function exampleWorldIntegration(world) {
  // In your main game loop, update the global pool
  // (This should be registered as a system)
  
  function updateParticles(world) {
    const pool = getGlobalParticlePool();
    const dt = world.dt || (1/60);
    pool.update(dt);
  }
  
  // Register as a system (conceptual - actual registration in main.js)
  // world.system(updateParticles, 'update');
  
  // In your render system, draw the particles
  function renderParticles(world) {
    const pool = getGlobalParticlePool();
    const ctx = world.renderContext?.ctx; // Get canvas context
    
    if (!ctx) return;
    
    pool.forEach(p => {
      if (!p.alive) return;
      
      // Calculate alpha based on lifetime
      const alpha = Math.max(0, p.life / p.lifeMax);
      
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      
      // Draw particle (simplified)
      const size = p.size * 10; // Scale to pixels
      ctx.fillRect(
        p.x * 16 - size/2,  // Convert world coords to screen
        p.y * 16 - size/2,
        size,
        size
      );
      
      ctx.globalAlpha = 1.0;
    });
  }
}

// ============================================================================
// Example 5: Advanced Particle Types
// ============================================================================

function exampleAdvancedParticles(world) {
  const pool = getGlobalParticlePool();
  
  // Trail particles with rotation
  for (let i = 0; i < 10; i++) {
    pool.spawn({
      x: 50,
      y: 40,
      vx: Math.cos(i * Math.PI / 5) * 1.5,
      vy: Math.sin(i * Math.PI / 5) * 1.5,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 10, // Radians per second
      life: 1.0,
      color: '#ff00ff',
      size: 1.2,
      sizeEnd: 0.3,
      type: 'trail'
    });
  }
  
  // Custom data payload
  const particle = pool.spawn({
    x: 55,
    y: 45,
    vx: 0,
    vy: 0,
    life: 3.0,
    color: '#ffff00',
    size: 2.0,
    type: 'custom',
    data: {
      // Store custom behavior data
      bounces: 0,
      maxBounces: 3,
      elasticity: 0.8
    }
  });
  
  // Later, in a custom update function, you can access particle.data
  // to implement special behaviors
}

// ============================================================================
// Example 6: Performance Monitoring
// ============================================================================

function examplePerformanceMonitoring() {
  const pool = getGlobalParticlePool();
  
  // Get detailed statistics
  const stats = pool.getStats();
  console.log('=== Particle Pool Statistics ===');
  console.log(`Active particles: ${stats.active}`);
  console.log(`Free particles: ${stats.free}`);
  console.log(`Total allocated: ${stats.total}`);
  console.log(`Maximum capacity: ${stats.max}`);
  console.log(`Utilization: ${stats.utilization}`);
  
  // Check if pool is getting full
  if (pool.count > pool.capacity * 0.8) {
    console.warn('Particle pool is 80% full! Consider reducing particle spawns.');
  }
  
  // Check available capacity before spawning many particles
  const particlesToSpawn = 100;
  if (pool.available >= particlesToSpawn) {
    spawnParticleBurst(world, {
      x: 60,
      y: 50,
      count: particlesToSpawn,
      spread: Math.PI * 2,
      speed: 1.0,
      life: 0.5
    });
  } else {
    console.warn(`Not enough capacity. Available: ${pool.available}, Needed: ${particlesToSpawn}`);
  }
}

// ============================================================================
// Example 7: Memory Management
// ============================================================================

function exampleMemoryManagement() {
  const pool = getGlobalParticlePool();
  
  // Periodic cleanup (e.g., every 5 seconds)
  // Keep 25% of max capacity or 512 particles in the free list
  const reserve = Math.max(512, Math.floor(pool.capacity * 0.25));
  const trimmed = pool.trim(reserve);
  
  console.log(`Trimmed ${trimmed} particles from free list`);
  
  // Clear all particles (useful for scene transitions)
  pool.clear();
  console.log('All particles cleared');
  
  // Reset the global pool (useful for cleanup/testing)
  // WARNING: This destroys the pool instance
  resetGlobalParticlePool();
  console.log('Global pool reset');
}

// ============================================================================
// Example 8: Direct Pool Access (Advanced)
// ============================================================================

function exampleDirectAccess() {
  const pool = getGlobalParticlePool();
  
  // Direct iteration over active particles (use with caution)
  for (let i = 0; i < pool._particles.length; i++) {
    const p = pool._particles[i];
    
    // Custom physics or behavior
    if (p.type === 'bouncy' && p.y < 0) {
      p.vy = -p.vy * 0.8; // Bounce with damping
      p.y = 0;
    }
  }
  
  // Note: Prefer using pool.forEach() for safety
  pool.forEach(p => {
    // Your custom logic here
    if (p.type === 'seeker') {
      // Move toward target
      const targetX = 100;
      const targetY = 100;
      const dx = targetX - p.x;
      const dy = targetY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        p.vx += (dx / dist) * 0.1;
        p.vy += (dy / dist) * 0.1;
      }
    }
  });
}

// ============================================================================
// Export examples for testing/documentation
// ============================================================================

export {
  exampleGlobalPool,
  exampleConvenienceSpawners,
  exampleCustomPool,
  exampleWorldIntegration,
  exampleAdvancedParticles,
  examplePerformanceMonitoring,
  exampleMemoryManagement,
  exampleDirectAccess
};
