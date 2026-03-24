import { Position } from "../components/Position.js";
import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { GroundStackOrder } from "../components/GroundStackOrder.js";
import { Equipment, getEquippedSlot } from "../components/Equipment.js";
import { DropIntent } from "../components/Intents/DropIntent.js";
import {
  placeOnGround,
  removeFromInventory,
  inventoryContains,
  splitItemStack,
} from "../utils/inventoryFacade.js";

const GROUND_STACK_SEQ_KEY = Symbol.for('jshack:groundStack:seq');

function nextGroundStackSeq(world) {
  const current = Number((/** @type {any} */(world))[GROUND_STACK_SEQ_KEY] || 0) | 0;
  const next = (current + 1) | 0;
  (/** @type {any} */(world))[GROUND_STACK_SEQ_KEY] = next;
  return next;
}

function stampGroundTop(world, itemId) {
  if (!(Number(itemId) > 0)) return;
  world.add(itemId, GroundStackOrder, { seq: nextGroundStackSeq(world) });
}

function clearEquippedSlotIfNeeded(world, actorId, itemId) {
  const eq = world.get(actorId, Equipment);
  if (!eq) return;
  const slot = getEquippedSlot(eq, Number(itemId) | 0);
  if (!slot) return;
  eq[slot] = null;
}

export function itemDropSystem(world) {
  for (const [actor, intent, pos] of world.query(DropIntent, Position, Inventory)) {
    const itemId = Number(intent.itemId) | 0;
    const inInventory = inventoryContains(world, actor, itemId);
    const eq = world.get(actor, Equipment);
    const equippedSlot = eq ? getEquippedSlot(eq, itemId) : null;
    const isEquipped = !!equippedSlot;
    if (!inInventory && !isEquipped) { world.remove(actor, DropIntent); continue; }
    const info = world.get(itemId, ItemInfo);
    if (!info) {
      if (inInventory) removeFromInventory(world, actor, itemId);
      if (isEquipped) clearEquippedSlotIfNeeded(world, actor, itemId);
      world.remove(actor, DropIntent);
      continue;
    }

    const dropCount = Math.min(info.count || 1, intent.count || info.count || 1);

    if (dropCount >= (info.count || 1)) {
      // drop whole entity
      if (inInventory) removeFromInventory(world, actor, itemId);
      if (isEquipped) clearEquippedSlotIfNeeded(world, actor, itemId);
      const placed = placeOnGround(world, itemId, pos.x, pos.y, { mergeCompatibleAmmo: true });
      if (placed.itemId > 0) stampGroundTop(world, placed.itemId);
      try { world.emit && world.emit('item:dropped', { actor, itemId: placed.itemId || itemId, count: dropCount, at:{ x: pos.x, y: pos.y } }); } catch (e) { console.debug('[itemDropSystem] emit item:dropped failed:', e); }
    } else {
      // split stack: keep the remainder in inventory, drop a cloned split-off item
      const newId = splitItemStack(world, itemId, dropCount);
      if (!(newId > 0)) {
        world.remove(actor, DropIntent);
        continue;
      }
      const placed = placeOnGround(world, newId, pos.x, pos.y, { mergeCompatibleAmmo: true });
      if (placed.itemId > 0) stampGroundTop(world, placed.itemId);
      try { world.emit && world.emit('item:dropped', { actor, itemId: placed.itemId || newId, count: dropCount, at:{ x: pos.x, y: pos.y } }); } catch (e) { console.debug('[itemDropSystem] emit item:dropped failed:', e); }
    }

    world.remove(actor, DropIntent);
  }
}
