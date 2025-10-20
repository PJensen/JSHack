import { defineComponent } from '../ecs/core.js';
import { Item } from '../core/item.js';

// Entity component: holds RPG-style stats and equipment slots
// - hp, maxHp: hit points
// - atk, def: combat stats
// - level, xp
// - slots: object mapping slot name -> item uid (or null)
export const Entity = defineComponent('Entity', {
  hp: 10,
  maxHp: 10,
  atk: 1,
  def: 0,
  level: 1,
  xp: 0,
  // equipment slots: head, body, main, off, feet, hands
  slots: { head: null, body: null, main: null, off: null, feet: null, hands: null }
});

// Convenience helper to apply damage; designed to be used with world.mutate or world.set
export function applyDamage(rec, amount){
  rec.hp = Math.max(0, rec.hp - amount);
  return rec.hp;
}

// Spawn a new actor entity and add the Entity component. Returns the entity id.
export function spawnEntity(world, props = {}){
  const id = world.create();
  const data = Object.assign({}, Entity.defaults, props);
  world.add(id, Entity, data);
  return id;
}

// Sum bonuses from equipped items on the actor (returns aggregated bonuses object)
export function getEquippedBonuses(world, actorId){
  const rec = world.get(actorId, Entity);
  if (!rec || !rec.slots) return {};
  const out = {};
  for (const slotName of Object.keys(rec.slots)){
    const itemId = rec.slots[slotName];
    if (!itemId) continue;
    const item = world.get(itemId, Item);
    if (!item || !item.bonuses) continue;
    for (const k of Object.keys(item.bonuses)){
      out[k] = (out[k] || 0) + (item.bonuses[k] || 0);
    }
  }
  return out;
}

export default Entity;
