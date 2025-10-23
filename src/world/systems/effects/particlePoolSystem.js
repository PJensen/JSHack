// Particle Pool Update System
// Updates the global pooled particle array (not ECS entities)

import { getGlobalParticlePool } from '../../effects/particlePool.js';

/**
 * Update system for pooled particles
 * Should run in the 'update' phase
 * @param {Object} world World instance
 */
export function particlePoolUpdateSystem(world) {
  const pool = getGlobalParticlePool();
  const dt = world.dt || (1/60); // Delta time in seconds
  
  // Update all particles in the pool
  pool.update(dt);
}

/**
 * Periodic cleanup system to trim excess free particles
 * Should run occasionally (not every frame) to reduce memory footprint
 * @param {Object} world World instance
 */
export function particlePoolCleanupSystem(world) {
  // Run cleanup every few seconds
  if (!world._particleCleanupTimer) {
    world._particleCleanupTimer = 0;
  }
  
  const dt = world.dt || (1/60);
  world._particleCleanupTimer += dt;
  
  // Cleanup every 5 seconds
  if (world._particleCleanupTimer >= 5.0) {
    world._particleCleanupTimer = 0;
    
    const pool = getGlobalParticlePool();
    const stats = pool.getStats();
    
    // Trim free list to 25% of max capacity or 512, whichever is larger
    const reserve = Math.max(512, Math.floor(pool.capacity * 0.25));
    const trimmed = pool.trim(reserve);
    
    // Optional: log cleanup for debugging (disabled by default to reduce console noise)
    // if (trimmed > 0) {
    //   console.log(`[ParticlePool] Trimmed ${trimmed} particles. Stats:`, stats);
    // }
  }
}
