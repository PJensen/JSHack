import { defineComponent } from '../ecs/core.js';
import { Entity } from './entity.js';

// Item component: attach to item entities. Designed as a data-only component.
// - uid: unique identifier string (optional)
// - kind: e.g. 'weapon','armor','consumable'
// - slot: equipment slot it fits into (or null) — string name like 'main' or 'head'
// - bonuses: simple stat bonuses { atk: +1, def: +2, ... }
// - affixes: array of strings for flavor
// - owner: entity id of the owning actor (optional)
// - equippedTo: entity id of the actor this item is equipped to (optional)
export const Item = defineComponent('Item', {
  uid: '',
  kind: 'generic',
  slot: null,
  bonuses: {},
  affixes: [],
  owner: null,
  equippedTo: null
});

// Create an item record (not performing world.add by itself). Prefer world.add(itemId, Item, makeItem(...)).
export function makeItem({ uid = '', kind = 'generic', slot = null, bonuses = {}, affixes = [], owner = null } = {}){
  return Object.assign({}, Item.defaults, { uid, kind, slot, bonuses, affixes, owner, equippedTo: null });
}

// ECS-aware helper: spawn an item entity and add Item component to world.
// Returns the created entity id.
export function spawnItem(world, props = {}){
  const id = world.create();
  world.add(id, Item, makeItem(props));
  return id;
}

export default Item;
