// MovementSystem
// Exports: applyMovement(world, dt)
// Moves entities that have {x,y,velocity:{dx,dy}} components. Simple position update.

export function applyMovement(world, dt){
  // world.query should provide an iterator of entities with components
  // We'll be defensive: if world.query is missing, do nothing.
  if (typeof world.query !== 'function') return;

  for (const eid of world.query('Position','Velocity')){
    const pos = world.getComponent(eid, 'Position');
    const vel = world.getComponent(eid, 'Velocity');
    if (!pos || !vel) continue;
    // simple Euler integration
    pos.x += vel.dx * dt;
    pos.y += vel.dy * dt;
    // mark changed if world has that API
    if (typeof world.setChanged === 'function') world.setChanged(eid, 'Position');
  }
}
