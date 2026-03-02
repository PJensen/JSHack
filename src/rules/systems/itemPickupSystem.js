import { Position } from "../components/Position.js";
import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { PickupIntent } from "../components/Intents/PickupIntent.js";
import { Settings } from "../components/Settings.js";
import { Player } from "../components/Player.js";
import { forEachItemAt } from "../utils/tileQueryCache.js";
import {
    addItemEntityToInventory,
    findInventoryStackTargetForItem,
} from "../utils/inventoryStacking.js";


export function itemPickupSystem(world) {
    // Explicit pickups via intent
    for (const [actor, intent, pos, inv] of world.query(PickupIntent, Position, Inventory)) {
        const itemId = intent.targetId;
        const itemPos = world.get(itemId, Position);
        const info = world.get(itemId, ItemInfo);
        if (!itemPos || !info) { world.remove(actor, PickupIntent); continue; }

        // must be within pickup range (default 0 = same tile)
        const set = world.get(actor, Settings);
        const maxRange = Math.max(0, Number(set?.pickupRange ?? 0));
        const dx = Math.abs((itemPos.x|0) - (pos.x|0));
        const dy = Math.abs((itemPos.y|0) - (pos.y|0));
        const dist = dx + dy; // Manhattan distance on grid
        if (dist > maxRange) {
            try { world.emit && world.emit('item:pickup-denied', { actor, itemId, reason: 'range', need: maxRange, at: { x: pos.x, y: pos.y }, itemAt: { x: itemPos.x, y: itemPos.y } }); } catch (e) { console.debug('[itemPickupSystem] emit item:pickup-denied failed:', e); }
            world.remove(actor, PickupIntent);
            continue;
        }

        const takeCount = Math.min(info.count || 1, intent.count || info.count || 1);

        // capacity gate (counts stacks, not total items)
        const stackIntoId = findInventoryStackTargetForItem(world, inv, itemId);
        const needsSlot = stackIntoId ? false : !inv.items.includes(itemId);
        const hasCapacity = stackIntoId || inv.capacity == null || inv.items.length < inv.capacity;
        if (!hasCapacity && needsSlot) {
            try { world.emit && world.emit('item:pickup-denied', { actor, itemId, reason: 'capacity' }); } catch (e) { console.debug('[itemPickupSystem] emit item:pickup-denied failed:', e); }
            world.remove(actor, PickupIntent);
            continue;
        }

        // perform pickup
        if (takeCount < (info.count || 1)) {
            // leave residual on ground; create a new inventory copy for the taken amount
            world.mutate(itemId, ItemInfo, (r) => { r.count -= takeCount; });
            const copy = world.create();
            const baseName = world.get(itemId, NamedIdentity);
            if (baseName) world.add(copy, NamedIdentity, { name: baseName.name, identity: baseName.identity });
            world.add(copy, ItemInfo, { ...info, count: takeCount });
            const moved = addItemEntityToInventory(world, inv, copy, { removePosition: false });
            if (moved.mode === "stacked") {
                try { world.emit && world.emit('item:pickup', { actor, itemId, count: takeCount, stackedIntoId: moved.stackedIntoId }); } catch (e) { console.debug('[itemPickupSystem] emit item:pickup failed:', e); }
            } else {
                try { world.emit && world.emit('item:pickup', { actor, itemId: copy, count: takeCount }); } catch (e) { console.debug('[itemPickupSystem] emit item:pickup failed:', e); }
            }
        } else {
            // whole stack
            const moved = addItemEntityToInventory(world, inv, itemId);
            if (moved.mode === "stacked") {
                try { world.emit && world.emit('item:pickup', { actor, itemId, count: takeCount, stackedIntoId: moved.stackedIntoId }); } catch (e) { console.debug('[itemPickupSystem] emit item:pickup failed:', e); }
            } else {
                try { world.emit && world.emit('item:pickup', { actor, itemId, count: takeCount }); } catch (e) { console.debug('[itemPickupSystem] emit item:pickup failed:', e); }
            }
        }

        world.remove(actor, PickupIntent);
    }
}

// Post-move auto-pickup pass (registered in 'effects' phase)
export function autoPickupPostMoveSystem(world) {
    for (const [id, pos, inv] of world.query(Player, Position, Inventory)) {
        const set = world.get(id, Settings);
        const enable = (set?.autoPickup !== false);
        if (!enable) continue;
        const kinds = Array.isArray(set?.autoPickupKinds) && set.autoPickupKinds.length ? set.autoPickupKinds : ["currency"];
        forEachItemAt(world, pos.x, pos.y, (itemId) => {
            if (!world.isAlive(itemId)) return;
            const ipos = world.get(itemId, Position);
            if (!ipos || ipos.x !== pos.x || ipos.y !== pos.y) return;
            const info = world.get(itemId, ItemInfo);
            if (!info || !info.type || !kinds.includes(info.type)) return;
            const takeCount = info.count || 1;
            addItemEntityToInventory(world, inv, itemId);
            try { world.emit && world.emit('item:pickup', { actor: id, itemId, count: takeCount }); } catch (e) { console.debug('[itemPickupSystem] emit item:pickup failed:', e); }
        });
    }
}
