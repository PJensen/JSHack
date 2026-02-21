import { Position } from "../components/Position.js";
import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { DropIntent } from "../components/Intents/DropIntent.js";

export function itemDropSystem(world) {
  for (const [actor, intent, pos, inv] of world.query(DropIntent, Position, Inventory)) {
    const itemId = intent.itemId;
    const idx = inv.items.indexOf(itemId);
    if (idx === -1) { world.remove(actor, DropIntent); continue; }
    const info = world.get(itemId, ItemInfo);
    if (!info) { inv.items.splice(idx,1); world.remove(actor, DropIntent); continue; }

    const dropCount = Math.min(info.count || 1, intent.count || info.count || 1);

    if (dropCount >= (info.count || 1)) {
      // drop whole stack
      inv.items.splice(idx, 1);
      // put the item back on ground
      world.add(itemId, Position, { x: pos.x, y: pos.y });
      try { world.emit && world.emit('item:dropped', { actor, itemId, count: dropCount, at:{ x: pos.x, y: pos.y } }); } catch (e) { console.debug('[itemDropSystem] emit item:dropped failed:', e); }
    } else {
      // split stack: create a new ground entity with dropCount
      world.mutate(itemId, ItemInfo, (r)=>{ r.count -= dropCount; });
      const newId = world.create();
      const ni = world.get(itemId, NamedIdentity);
      if (ni) world.add(newId, NamedIdentity, { name: ni.name, identity: ni.identity });
      world.add(newId, ItemInfo, { ...info, count: dropCount });
      world.add(newId, Position, { x: pos.x, y: pos.y });
      try { world.emit && world.emit('item:dropped', { actor, itemId: newId, count: dropCount, at:{ x: pos.x, y: pos.y } }); } catch (e) { console.debug('[itemDropSystem] emit item:dropped failed:', e); }
    }

    world.remove(actor, DropIntent);
  }
}
