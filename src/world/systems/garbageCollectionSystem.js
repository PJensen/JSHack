import { Dead } from '../components/Dead.js';
import { Lifetime } from '../components/Lifetime.js';
import { RenderContext } from '../components/RenderContext.js';

// Garbage collection system
// - Destroys entities marked Dead
// - Trims large free lists on effect/particle pools attached to RenderContext
// This runs in 'late' (recommended) after other systems so we don't race with
// systems that may mark entities dead during update.
export function garbageCollectionSystem(world, dt){
  // Collect Dead entities in a batch so we avoid modifying the query while iterating
  const toDestroy = [];
  try{
    for (const [id, d] of world.query(Dead)){
      if (d && d.dead) toDestroy.push(id);
    }
  } catch(e){ /* defensive: if queries fail, carry on */ }

  for (const id of toDestroy){
    try{ world.destroy(id); } catch(e){ /* ignore race conditions */ }
  }

  // Defensive: some transient entities use Lifetime and may have escaped other
  // cleanup; destroy any with ttl <= -10 (very stale) to avoid zombie entities.
  try{
    for (const [id, life] of world.query(Lifetime)){
      if (life && typeof life.ttl === 'number' && life.ttl <= -10){
        try{ world.destroy(id); } catch(e){}
      }
    }
  } catch(e){ /* ignore */ }

  // Trim particle/effect pools attached to RenderContext to release excess
  // pooled objects back to the JS heap so the browser can reclaim memory.
  try{
    const rcId = world.renderContextId;
    if (rcId){
      const renderCtx = world.get(rcId, RenderContext);
      const ps = renderCtx && renderCtx.particleSystem;
      if (ps && ps._pool && typeof ps._pool.trim === 'function'){
        try{
          ps._pool.trim();
        } catch(e){ /* ignore */ }
      }
    }
  } catch(e){ /* ignore */ }
}

export default garbageCollectionSystem;
