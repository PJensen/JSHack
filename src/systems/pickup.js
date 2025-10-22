// PickupSystem
// Exports: runPickup(world)
// If an entity with Inventory overlaps an entity with Item and Pickup tag, add item to inventory and remove item entity.

export function runPickup(world){
  if (typeof world.query !== 'function') return;
  // naive collision: same integer position
  const items = Array.from(world.query('Item','Position'));
  for (const pid of world.query('Inventory','Position')){
    const pinv = world.getComponent(pid, 'Inventory');
    const ppos = world.getComponent(pid, 'Position');
    if (!pinv || !ppos) continue;
    for (const iid of items){
      const ipos = world.getComponent(iid, 'Position');
      if (!ipos) continue;
      if (Math.floor(ipos.x) === Math.floor(ppos.x) && Math.floor(ipos.y) === Math.floor(ppos.y)){
        // pick up
        pinv.items = pinv.items || [];
        pinv.items.push(iid);
        if (typeof world.removeEntity === 'function') world.removeEntity(iid);
        else if (typeof world.removeComponent === 'function') world.removeComponent(iid, 'Item');
      }
    }
  }
}
