import { Lifetime } from '../components/Lifetime.js';

// Decrements ttl and destroys entities when expired
export function lifetimeSystem(world, dt) {
  for (const [id, life] of world.query(Lifetime)) {
    life.ttl -= dt;
    // Mutated in-place; ensure change-tracking picks this up for systems relying on Changed(...)
    try { world.markChanged(id, Lifetime); } catch(e) { /* ignore in constrained runtimes */ }
    if (life.ttl <= 0) {
      world.destroy(id);
    }
  }
}
