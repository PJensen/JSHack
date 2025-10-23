// Rendering Utilities
// READONLY: This utility performs no mutations - only reads world state
import { RenderContext } from '../../components/RenderContext.js';

/**
 * Fast helper to resolve the active RenderContext from the world.
 * Prefers a cached id on the world via world.renderContextId + getInstance,
 * falling back to a query when necessary.
 *
 * Returns null when no RenderContext is available, or an object { ctx, W, H, rec }.
 */
export function getRenderContext(world){
  if (!world) return null;
  // Prefer cached id + getInstance for O(1) access
  if (world.renderContextId && typeof world.getInstance === 'function'){
    try{
      const rec = world.getInstance(world.renderContextId, RenderContext);
      if (rec && rec.ctx) return { ctx: rec.ctx, W: rec.canvas?.width, H: rec.canvas?.height, rec };
    }catch(e){ /* ignore */ }
  }
  // Fallback: iterate first RenderContext entity
  try{
    for (const { id } of world.query(RenderContext)){
      const rec = world.get(id, RenderContext);
      if (rec && rec.ctx) return { ctx: rec.ctx, W: rec.canvas?.width, H: rec.canvas?.height, rec };
    }
  }catch(e){ /* ignore */ }
  return null;
}
