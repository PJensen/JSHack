// Unified render systems index (named exports)
export { getRenderContext } from './utils.js';

// Core renderers
export { playerRenderSystem } from './core/playerRenderer.js';
export { tileRenderSystem } from './core/tileRenderer.js';
export { tileGlyphRenderSystem } from './core/tileGlyphRenderer.js';
export { wallGeometryRenderSystem } from './core/wallGeometryRenderer.js';
export { itemRenderSystem } from './core/itemRenderer.js';
export { actorRenderSystem } from './core/actorRenderer.js';
export { effectRenderSystem } from './core/effectRenderer.js';

// Lighting
export { tileLightingRenderSystem } from './lighting/tileLightingRenderer.js';
export { entityLightingRenderSystem } from './lighting/entityLightingRenderer.js';
export { glowRenderSystem } from './lighting/glowRenderer.js';
export { shadowRenderSystem } from './lighting/shadowRenderer.js';
export { bloomRenderSystem } from './lighting/bloomRenderer.js';

// Post-processing
export { postProcessingRenderSystem } from './post-processing/postProcessingRenderer.js';
export { hallucinationPostProcessRenderer } from './post-processing/hallucinationPostProcessRenderer.js';
