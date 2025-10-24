// Unified Rendering Utilities
// READONLY: This utility performs no mutations - only reads world state
import { RenderContext } from '../../components/RenderContext.js';

// Return the active RenderContext component directly
export function getRenderContext(world) {
  const id = world && world.renderContextId;
  return id ? world.get(id, RenderContext) : null;
}
