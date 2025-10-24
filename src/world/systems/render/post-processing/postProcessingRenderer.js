// Post-Processing Render System
// Stub for post-processing pass (e.g., screen-space effects)
// READONLY: performs no mutations — only reads world state and draws to canvas
import { getRenderContext } from '../utils.js';

export function postProcessingRenderSystem(world) {
  const rc = getRenderContext(world);
  if (!rc) return;
  const { ctx, W, H } = rc;
  // Placeholder: apply post effects to ctx if needed
}
