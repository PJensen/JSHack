import { Effect } from '../../components/Effect.js';

// Tick effect lifetimes and destroy when expired
export function effectLifetimeSystem(world, dt){
  for (const [id, eff] of world.query(Effect)){
    if (!eff.ttl) continue;
  eff.ttl -= dt;
  // Mutated in-place: ensure Changed tracking
  try { world.markChanged(id, Effect); } catch(e) { /* ignore */ }
  // clear justSpawned after first tick
  if (eff.data && eff.data.justSpawned) eff.data.justSpawned = false;
    if (eff.ttl <= 0){
      try { world.destroy(id); } catch(e) { /* ignore race conditions */ }
    }
  }
}
