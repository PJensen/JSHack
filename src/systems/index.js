// Systems index
// Exports named systems so main can import and register them.

export { applyMovement } from './movement.js';
export { runAI } from './ai.js';
export { createRenderSystem } from './render.js';
export { processCombat } from './combat.js';
export { runPickup } from './pickup.js';

// Helper to register all systems with a world
export function registerDefaultSystems(world, opts = {}){
  // opts may include {canvas, cellSize}
  if (opts.canvas){
    const render = createRenderSystem(opts.canvas, {cellSize: opts.cellSize});
    world.system(render, 'render');
  }
  world.system(applyMovement, 'movement');
  world.system(runAI, 'ai');
  world.system(processCombat, 'combat');
  world.system(runPickup, 'pickup');
}
