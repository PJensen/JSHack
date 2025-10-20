// RenderSystem
// Exports: createRenderSystem(canvas, opts) -> function(world, dt)
// Draws entities with Position + Renderable components to a canvas 2D context.

export function createRenderSystem(canvas, opts = {}){
  const ctx = canvas.getContext('2d');
  const cellSize = opts.cellSize || 16;

  return function renderSystem(world, dt){
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0,0,w,h);

    if (typeof world.query !== 'function') return;
    for (const eid of world.query('Position','Renderable')){
      const pos = world.getComponent(eid, 'Position');
      const r = world.getComponent(eid, 'Renderable');
      if (!pos || !r) continue;
      ctx.fillStyle = r.color || 'white';
      ctx.fillRect(Math.floor(pos.x*cellSize), Math.floor(pos.y*cellSize), cellSize, cellSize);
      if (r.char){
        ctx.fillStyle = r.charColor || 'black';
        ctx.fillText(r.char, Math.floor(pos.x*cellSize)+2, Math.floor(pos.y*cellSize)+cellSize-2);
      }
    }
  };
}
