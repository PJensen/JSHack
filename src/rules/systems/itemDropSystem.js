import { Position } from "../components/Position.js";
import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { DropIntent } from "../components/Intents/DropIntent.js";
import {
  removeFromInventory,
  inventoryContains,
  splitItemStack,
} from "../utils/inventoryFacade.js";

export function itemDropSystem(world) {
  for (const [actor, intent, pos] of world.query(DropIntent, Position, Inventory)) {
    const itemId = intent.itemId;
    if (!inventoryContains(world, actor, itemId)) { world.remove(actor, DropIntent); continue; }
    const info = world.get(itemId, ItemInfo);
    if (!info) { removeFromInventory(world, actor, itemId); world.remove(actor, DropIntent); continue; }

    const dropCount = Math.min(info.count || 1, intent.count || info.count || 1);

    if (dropCount >= (info.count || 1)) {
      // drop whole entity
      removeFromInventory(world, actor, itemId);
      world.add(itemId, Position, { x: pos.x, y: pos.y });
      try { world.emit && world.emit('item:dropped', { actor, itemId, count: dropCount, at:{ x: pos.x, y: pos.y } }); } catch (e) { console.debug('[itemDropSystem] emit item:dropped failed:', e); }
    } else {
      // split stack: keep the remainder in inventory, drop a cloned split-off item
      const newId = splitItemStack(world, itemId, dropCount);
      if (!(newId > 0)) {
        world.remove(actor, DropIntent);
        continue;
      }
      world.add(newId, Position, { x: pos.x, y: pos.y });
      try { world.emit && world.emit('item:dropped', { actor, itemId: newId, count: dropCount, at:{ x: pos.x, y: pos.y } }); } catch (e) { console.debug('[itemDropSystem] emit item:dropped failed:', e); }
    }

    world.remove(actor, DropIntent);
  }
}
