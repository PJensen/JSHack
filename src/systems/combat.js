// CombatSystem
// Exports: processCombat(world)
// Very small: if an entity has PendingDamage component, apply to HP and remove the pending.

export function processCombat(world){
  if (typeof world.query !== 'function') return;
  for (const eid of world.query('PendingDamage','HP')){
    const dmg = world.getComponent(eid, 'PendingDamage');
    const hp = world.getComponent(eid, 'HP');
    if (!dmg || !hp) continue;
    hp.current -= dmg.amount;
    if (hp.current <= 0){
      hp.current = 0;
      // mark dead if world supports events
      if (typeof world.emit === 'function') world.emit('entity:died', eid);
    }
    // remove pending damage; world.removeComponent might exist
    if (typeof world.removeComponent === 'function') world.removeComponent(eid, 'PendingDamage');
  }
}
