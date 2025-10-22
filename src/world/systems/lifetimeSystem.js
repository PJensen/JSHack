import { Lifetime } from '../components/Lifetime.js';

// Decrements ttl and destroys entities when expired
export function lifetimeSystem(world, dt) {
  for (const [id, life] of world.query(Lifetime)) {
    life.ttl -= dt;
    if (life.ttl <= 0) {
      world.destroy(id);
    }
  }
}
