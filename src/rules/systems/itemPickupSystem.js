import { Position } from "../components/Position.js";
import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { PickupIntent } from "../components/Intents/PickupIntent.js";
import { Settings } from "../components/Settings.js";
import { Player } from "../components/Player.js";

// Helper: sum inventory weight
function inventoryWeight(world, inv) {
    let total = 0;
    for (const id of inv.items) {
        const ii = world.get(id, ItemInfo);
        if (ii) total += (ii.weight || 0) * (ii.count || 1);
    }
    return total;
}

// Helper: find matching stack by identity
function findStackTarget(world, inv, itemId) {
    const ident = world.get(itemId, NamedIdentity)?.identity;
    if (!ident) return 0;
    for (const id of inv.items) {
        if (id === itemId) continue;
        const n = world.get(id, NamedIdentity);
        if (n && n.identity === ident) return id;
    }
    return 0;
}
    
function findStackTargetByIdentity(world, inv, identity) {
    if (!identity) return 0;
    for (const id of inv.items) {
        const n = world.get(id, NamedIdentity);
        if (n && n.identity === identity) return id;
    }
    return 0;
}

export function itemPickupSystem(world) {
    // Explicit pickups via intent
    for (const [actor, intent, pos, inv] of world.query(PickupIntent, Position, Inventory)) {
        const itemId = intent.targetId;
        const itemPos = world.get(itemId, Position);
        const info = world.get(itemId, ItemInfo);
        if (!itemPos || !info) { world.remove(actor, PickupIntent); continue; }

        // must be at same tile
        if (itemPos.x !== pos.x || itemPos.y !== pos.y) {
            // targetId mismatch/no-op
            world.remove(actor, PickupIntent);
            continue;
        }

        const takeCount = Math.min(info.count || 1, intent.count || info.count || 1);

        // capacity gate (counts stacks, not total items)
        const stackIntoId = findStackTarget(world, inv, itemId);
        const needsSlot = stackIntoId ? false : !inv.items.includes(itemId);
        const hasCapacity = stackIntoId || inv.capacity == null || inv.items.length < inv.capacity;
        if (!hasCapacity && needsSlot) {
            try { world.emit && world.emit('item:pickup-denied', { actor, itemId, reason: 'capacity' }); } catch { }
            world.remove(actor, PickupIntent);
            continue;
        }

        // weight gate
        const addWeight = (info.weight || 0) * (takeCount || 1);
        if (inv.weightLimit != null) {
            const cur = inventoryWeight(world, inv);
            if (cur + addWeight > inv.weightLimit) {
                try { world.emit && world.emit('item:pickup-denied', { actor, itemId, reason: 'weight' }); } catch { }
                world.remove(actor, PickupIntent);
                continue;
            }
        }

        // perform pickup
        if (stackIntoId) {
            // merge counts
            world.mutate(stackIntoId, ItemInfo, (r) => { r.count = (r.count || 1) + takeCount; });
            if (takeCount >= (info.count || 1)) {
                world.destroy(itemId);
            } else {
                world.mutate(itemId, ItemInfo, (r) => { r.count -= takeCount; });
            }
            try { world.emit && world.emit('item:pickup', { actor, itemId, count: takeCount, stackedIntoId: stackIntoId }); } catch { }
        } else {
            // move item into inventory as its own stack
            // remove from ground
            world.remove(itemId, Position);
            // split if partial pickup
            if (takeCount < (info.count || 1)) {
                // leave residual on ground; create a new inventory copy
                world.mutate(itemId, ItemInfo, (r) => { r.count -= takeCount; });
                const copy = world.create();
                const baseName = world.get(itemId, NamedIdentity);
                if (baseName) world.add(copy, NamedIdentity, { name: baseName.name, identity: baseName.identity });
                world.add(copy, ItemInfo, { ...info, count: takeCount });
                inv.items.push(copy);
                try { world.emit && world.emit('item:pickup', { actor, itemId: copy, count: takeCount }); } catch { }
            } else {
                // whole stack
                inv.items.push(itemId);
                try { world.emit && world.emit('item:pickup', { actor, itemId, count: takeCount }); } catch { }
            }
        }

        world.remove(actor, PickupIntent);
    }
}

// Post-move auto-pickup pass (registered in 'effects' phase)
export function autoPickupPostMoveSystem(world) {
    for (const [id, _pos, inv] of world.query(Position, Inventory)) {
        if (!world.has(id, Player)) continue;
        const set = world.get(id, Settings);
        const enable = (set?.autoPickup !== false);
        if (!enable) continue;
        const kinds = Array.isArray(set?.autoPickupKinds) && set.autoPickupKinds.length ? set.autoPickupKinds : ["currency"];
        const pos = world.get(id, Position);
        if (!pos) continue;
        const candidates = [];
        for (const [itemId] of world.query(Position)) {
            const ipos = world.get(itemId, Position);
            if (!ipos || ipos.x !== pos.x || ipos.y !== pos.y) continue;
            const info = world.get(itemId, ItemInfo);
            if (!info || !info.type || !kinds.includes(info.type)) continue;
            candidates.push(itemId);
        }
        for (const itemId of candidates) {
            const info = world.get(itemId, ItemInfo);
            if (!info) continue;
            const takeCount = info.count || 1;
            const name = world.get(itemId, NamedIdentity);
            const stackTarget = findStackTargetByIdentity(world, inv, name?.identity);
            if (stackTarget) {
                world.mutate(stackTarget, ItemInfo, (r) => { r.count = (r.count || 1) + takeCount; });
                world.destroy(itemId);
            } else {
                try { world.remove(itemId, Position); } catch {}
                inv.items.push(itemId);
            }
            try { world.emit && world.emit('item:pickup', { actor: id, itemId, count: takeCount }); } catch {}
        }
    }
}
