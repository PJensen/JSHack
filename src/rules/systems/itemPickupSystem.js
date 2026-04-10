import { Position } from "../components/Position.js";
import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { PickupIntent } from "../components/Intents/PickupIntent.js";
import { Settings } from "../components/Settings.js";
import { Player } from "../components/Player.js";
import { forEachItemAt } from "../utils/tileQueryCache.js";
import {
    addToInventory,
    hasCapacityForItem,
    inventoryContains,
    splitItemStack,
    transferItem,
} from "../utils/inventoryFacade.js";
import { emitSafe } from "../utils/emitSafe.js";
import { isChestIdentity } from "../../shared/chests.js";


export function itemPickupSystem(world) {
    // Explicit pickups via intent
    for (const [actor, intent, pos] of world.query(PickupIntent, Position, Inventory)) {
        const itemId = intent.targetId;
        const info = world.get(itemId, ItemInfo);
        if (!info) { world.remove(actor, PickupIntent); continue; }

        // Must be within pickup range. Death-scattered loot stays on the death
        // tile in ECS but is visually flung outward, so we allow a generous
        // base radius (Chebyshev 3) for any ground item.
        const set = world.get(actor, Settings);
        const extraRange = Math.max(0, Number(set?.pickupRange ?? 0));
        const maxRange = Math.max(3, extraRange);
        const itemPos = world.get(itemId, Position);
        const inContainer = !itemPos;
        const takeCount = Math.min(info.count || 1, intent.count || info.count || 1);

        // capacity gate (counts unique identity stacks)
        if (!hasCapacityForItem(world, actor, itemId)) {
            emitSafe(world, 'item:pickup-denied', { actor, itemId, reason: 'capacity' });
            world.remove(actor, PickupIntent);
            continue;
        }

        if (inContainer) {
            // Container-source pickup fallback (chest items selected via world pickup UI).
            let sourceChestId = 0;
            let sourceChestPos = null;
            for (const [chestId, chestPos, ni] of world.query(Position, NamedIdentity)) {
                if (!isChestIdentity(ni.identity)) continue;
                if (!inventoryContains(world, chestId, itemId)) continue;
                sourceChestId = chestId;
                sourceChestPos = chestPos;
                break;
            }
            if (!(sourceChestId > 0)) {
                world.remove(actor, PickupIntent);
                continue;
            }

            if (takeCount < (info.count || 1)) {
                const copy = splitItemStack(world, itemId, takeCount);
                if (!(copy > 0)) {
                    world.remove(actor, PickupIntent);
                    continue;
                }
                addToInventory(world, actor, copy);
                emitSafe(world, 'item:pickup', {
                    actor,
                    itemId: copy,
                    count: takeCount,
                    itemX: sourceChestPos?.x,
                    itemY: sourceChestPos?.y,
                    sourceContainerId: sourceChestId,
                });
            } else {
                transferItem(world, itemId, sourceChestId, actor);
                emitSafe(world, 'item:pickup', {
                    actor,
                    itemId,
                    count: takeCount,
                    itemX: sourceChestPos?.x,
                    itemY: sourceChestPos?.y,
                    sourceContainerId: sourceChestId,
                });
            }
        } else {
            const dx = Math.abs((itemPos.x | 0) - (pos.x | 0));
            const dy = Math.abs((itemPos.y | 0) - (pos.y | 0));
            const dist = Math.max(dx, dy); // Chebyshev distance
            if (dist > maxRange) {
                emitSafe(world, 'item:pickup-denied', { actor, itemId, reason: 'range', need: maxRange, at: { x: pos.x, y: pos.y }, itemAt: { x: itemPos.x, y: itemPos.y } });
                world.remove(actor, PickupIntent);
                continue;
            }

            // perform pickup
            const ix = itemPos.x;
            const iy = itemPos.y; // snapshot before addToInventory removes Position
            if (takeCount < (info.count || 1)) {
                // leave residual on ground; move a split-off copy into inventory
                const copy = splitItemStack(world, itemId, takeCount);
                if (!(copy > 0)) {
                    world.remove(actor, PickupIntent);
                    continue;
                }
                addToInventory(world, actor, copy);
                emitSafe(world, 'item:pickup', { actor, itemId: copy, count: takeCount, itemX: ix, itemY: iy });
            } else {
                // whole stack — just attach to inventory (entity persists as-is)
                addToInventory(world, actor, itemId);
                emitSafe(world, 'item:pickup', { actor, itemId, count: takeCount, itemX: ix, itemY: iy });
            }
        }

        world.remove(actor, PickupIntent);
    }
}

// Post-move auto-pickup pass (registered in 'effects' phase)
export function autoPickupPostMoveSystem(world) {
    for (const [id, pos] of world.query(Player, Position, Inventory)) {
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
            addToInventory(world, id, itemId);
            emitSafe(world, 'item:pickup', { actor: id, itemId, count: takeCount, itemX: pos.x, itemY: pos.y });
        });
    }
}
