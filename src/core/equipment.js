import { Item } from './item.js';
import { Entity } from './entity.js';

// Equip an item entity to an actor entity. - actorId: entity with Entity component
// - itemId: entity with Item component. If the item's slot is occupied it will be replaced.
// Returns true on success.
export function equip(world, actorId, itemId){
  const item = world.get(itemId, Item);
  if (!item) throw new Error('equip: item does not exist on entity ' + itemId);
  const actor = world.get(actorId, Entity);
  if (!actor) throw new Error('equip: actor does not have Entity component: ' + actorId);
  const slot = item.slot;
  if (!slot) throw new Error('equip: item has no slot: ' + itemId);

  // If something is already in the slot, unequip it first
  const prev = actor.slots && actor.slots[slot];
  if (prev){
    // clear previous item equippedTo
    world.mutate(prev, Item, (r) => { if (r) r.equippedTo = null; });
  }

  // Assign the item to the actor's slot and set equipped flags on the item
  world.mutate(actorId, Entity, (rec) => { rec.slots = Object.assign({}, rec.slots || {}, { [slot]: itemId }); });
  world.set(itemId, Item, { equippedTo: actorId, owner: actorId });
  return true;
}

// Unequip item (clear equippedTo). Does not delete the item.
export function unequip(world, itemId){
  const item = world.get(itemId, Item);
  if (!item) return false;
  const ownerId = item.equippedTo || item.owner;
  if (ownerId){
    // clear the owner's slot that references this item
    world.mutate(ownerId, Entity, (rec) => {
      if (!rec || !rec.slots) return;
      for (const k of Object.keys(rec.slots)){
        if (rec.slots[k] === itemId) rec.slots[k] = null;
      }
    });
  }
  world.set(itemId, Item, { equippedTo: null });
  return true;
}

export default { equip, unequip };
