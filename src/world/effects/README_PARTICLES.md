# Pooled Particle System

High-performance particle system using object pools to avoid memory allocation overhead and GC pauses. Particles are **NOT ECS entities** to maximize performance.

## Architecture

### Core Files

- **`particlePool.js`** - Core pooled particle array implementation
- **`spawner.js`** - Convenience functions for spawning particles and effects
- **`particlePoolSystem.js`** - ECS systems for updating and cleaning the particle pool
- **`particlePoolExamples.js`** - Usage examples and integration patterns

### Integration

The particle system integrates with the ECS world but particles themselves are plain objects:

1. **Update Phase**: `particlePoolUpdateSystem` updates all active particles
2. **Render Phase**: `effectRendererSystem` renders pooled particles to canvas
3. **Cleanup Phase**: `particlePoolCleanupSystem` periodically trims excess memory

## Quick Start

### Basic Usage

```javascript
import { spawnParticleBurst, spawnHitParticles } from './world/effects/spawner.js';

// Spawn a burst of particles
spawnParticleBurst(world, {
  x: 10,
  y: 5,
  count: 16,
  spread: Math.PI * 2,
  speed: 1.5,
  life: 0.8,
  color: '#ff0000'
});

// Spawn hit effect particles
spawnHitParticles(world, 15, 10, {
  color: '#ff6b6b',
  count: 8
});
```

### Registering Systems

In `main.js`:

```javascript
import { particlePoolUpdateSystem, particlePoolCleanupSystem } from './world/systems/effects/particlePoolSystem.js';

// Register update system (runs every frame)
world.system(particlePoolUpdateSystem, 'update');

// Register cleanup system (periodic memory management)
world.system(particlePoolCleanupSystem, 'late');
```

## API Reference

### createParticlePool(options)

Create a new particle pool instance.

**Options:**
- `initialSize` (default: 2048) - Pre-allocated pool size
- `maxSize` (default: 4096) - Maximum capacity (hard cap)
- `gravity` (default: 0.0) - Default gravity acceleration

**Returns:** Particle pool object

### getGlobalParticlePool()

Get or create the global particle pool singleton.

**Returns:** Global particle pool instance

### Particle Pool Methods

#### `spawn(props)` → `Particle|null`

Allocate and configure a single particle.

**Props:**
- `x`, `y` - Position (world coordinates)
- `vx`, `vy` - Velocity
- `ax`, `ay` - Acceleration
- `life` - Lifetime in seconds
- `size`, `sizeEnd` - Size at birth and death
- `color` - CSS color string
- `alpha` - Opacity multiplier (0-1)
- `rotation`, `rotationSpeed` - Rotation in radians
- `type` - Custom type/tag string
- `data` - Custom data payload

**Returns:** Particle object or `null` if pool exhausted

#### `spawnBurst(opts)` → `number`

Spawn a burst of particles in a spread pattern.

**Options:**
- `x`, `y` - Center position
- `count` - Number of particles
- `spread` - Angular spread in radians
- `angle` - Center angle
- `speed`, `speedVariance` - Speed configuration
- `life`, `lifeVariance` - Lifetime configuration
- `size`, `sizeEnd` - Size configuration
- `color` - Particle color
- `vx`, `vy` - Base velocity offset
- `ax`, `ay` - Acceleration
- `type` - Custom type tag

**Returns:** Number of particles spawned (may be less than `count` if pool is full)

#### `update(dt)`

Update all active particles (physics, lifetime, etc.).

**Parameters:**
- `dt` - Delta time in seconds

#### `forEach(fn)`

Iterate over all active particles.

**Parameters:**
- `fn(particle, index)` - Callback function

#### `clear()`

Remove all active particles and return them to the pool.

#### `trim(reserve)` → `number`

Trim the free list to reduce memory usage.

**Parameters:**
- `reserve` (default: 256) - Number of particles to keep in free list

**Returns:** Number of particles removed

#### `getStats()` → `Object`

Get pool statistics.

**Returns:**
```javascript
{
  active: 0,           // Active particles
  free: 2048,          // Free particles in pool
  total: 2048,         // Total allocated
  max: 4096,           // Maximum capacity
  utilization: '0.0%'  // Percentage full
}
```

### Convenience Spawners (in spawner.js)

#### `spawnParticle(world, props)` → `Particle|null`

Spawn a single particle using the global pool.

#### `spawnParticleBurst(world, opts)` → `number`

Spawn a particle burst using the global pool.

#### `spawnHitParticles(world, x, y, opts)` → `number`

Spawn hit/impact particles.

**Options:**
- `color` (default: '#ff6b6b')
- `count` (default: 8)
- `speed` (default: 1.2)
- `life` (default: 0.4)
- `size` (default: 0.8)
- `gravity` (default: -0.5)

#### `spawnDeathParticles(world, x, y, opts)` → `number`

Spawn death/explosion particles.

**Options:**
- `color` (default: '#888888')
- `count` (default: 16)
- `speed` (default: 2.0)
- `life` (default: 0.8)
- `size` (default: 1.2)
- `gravity` (default: -1.0)

#### `spawnMagicParticles(world, x, y, opts)` → `number`

Spawn magical/spell particles.

**Options:**
- `color` (default: '#4da6ff')
- `count` (default: 12)
- `spread` (default: 2π)
- `angle` (default: 0)
- `speed` (default: 0.8)
- `life` (default: 1.0)
- `size` (default: 0.6)
- `gravity` (default: 0.2)

## Performance Considerations

### Memory Management

The particle pool has a **hard cap** on maximum particles to prevent unbounded memory growth:

- **Initial allocation**: 2048 particles pre-allocated
- **Maximum capacity**: 4096 particles (configurable)
- **Pool exhaustion**: Returns `null` instead of allocating beyond max

### Best Practices

1. **Check return values**: `spawn()` returns `null` when pool is full
2. **Periodic cleanup**: Use `particlePoolCleanupSystem` for automatic trimming
3. **Monitor utilization**: Use `getStats()` to track pool usage
4. **Batch spawns**: Use `spawnBurst()` for multiple particles
5. **Custom pools**: Create dedicated pools for specific effect types

### Performance Benefits vs ECS Entities

| Metric | Pooled Particles | ECS Entities |
|--------|------------------|--------------|
| Allocation overhead | ~0 (reused) | High (new entity + components) |
| GC pressure | Minimal | High |
| Memory footprint | Fixed | Growing |
| Update speed | Direct array iteration | Query + component lookup |
| Typical capacity | 4096+ particles | ~1000 entities before slowdown |

## Example Patterns

### Continuous Effect

```javascript
// Fire pit that spawns particles every frame
function fireSystem(world) {
  const dt = world.dt || 1/60;
  
  // Spawn 2-3 fire particles per frame
  const count = Math.floor(Math.random() * 2) + 2;
  
  spawnParticleBurst(world, {
    x: firePitX,
    y: firePitY,
    count,
    spread: Math.PI / 4,
    angle: -Math.PI / 2, // Upward
    speed: 1.0,
    life: 0.6,
    color: Math.random() > 0.5 ? '#ff4500' : '#ffa500',
    size: 0.8,
    sizeEnd: 0.1,
    ay: 0.5 // Float upward
  });
}
```

### Custom Particle Behavior

```javascript
// Custom update with special physics
function customParticleUpdate(world) {
  const pool = getGlobalParticlePool();
  
  pool.forEach(p => {
    // Seeker particles that move toward player
    if (p.type === 'seeker') {
      const playerX = world.playerPos?.x || 0;
      const playerY = world.playerPos?.y || 0;
      const dx = playerX - p.x;
      const dy = playerY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > 0.1) {
        const force = 2.0;
        p.vx += (dx / dist) * force * world.dt;
        p.vy += (dy / dist) * force * world.dt;
      }
    }
  });
}
```

## Migration from ECS Entity Particles

If you have existing particle entities, migrate to the pooled system:

**Before (ECS entities):**
```javascript
const e = world.create();
world.add(e, Position, { x, y });
world.add(e, Velocity, { vx, vy });
world.add(e, Lifetime, { ttl: 1.0 });
world.add(e, Particle, { color: '#ff0000', size: 1 });
```

**After (Pooled particles):**
```javascript
spawnParticle(world, {
  x, y, vx, vy,
  life: 1.0,
  color: '#ff0000',
  size: 1
});
```

## Troubleshooting

### Particles not appearing

1. Check that `particlePoolUpdateSystem` is registered
2. Verify `effectRendererSystem` is rendering pooled particles
3. Confirm camera coordinates are correct in render context

### Pool exhausted warnings

1. Increase `maxSize` in pool configuration
2. Reduce particle spawn rate
3. Decrease particle lifetime
4. Check for particle leaks (particles not dying)

### Memory growing over time

1. Ensure `particlePoolCleanupSystem` is running
2. Call `trim()` manually if needed
3. Verify particles are properly dying (life reaches 0)

## See Also

- `particlePoolExamples.js` - Comprehensive usage examples
- `effectRendererSystem.js` - Rendering implementation
- `particlePoolSystem.js` - Update and cleanup systems
