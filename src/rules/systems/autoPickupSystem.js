// src/rules/systems/autoPickupSystem.js
// Automatically pick up currency stacks (e.g., gold) when the player stands on them.
// Deterministic, rules-side. Kept focused to currency to minimize behavioral impact.

import { ItemInfo } from "../components/ItemInfo.js";
import { addToInventory } from "../utils/inventoryFacade.js";
import { emitSafe } from "../utils/emitSafe.js";
import { xyKey } from "../utils/gridKey.js";
import { queryAllPositions, queryPlayerPosInv } from "../utils/queries.js";

export function autoPickupSystem(world) {
  // Build a lookup from tile -> item ids for currency only
  const itemsAt = new Map(); // "x,y" -> [id]
  for (const [id, pos] of queryAllPositions(world)) {
    const info = world.get(id, ItemInfo);
    if (!info || info.type !== "currency") continue;
    const k = xyKey(pos.x, pos.y);
    let arr = itemsAt.get(k);
    if (!arr) itemsAt.set(k, (arr = []));
    arr.push(id);
  }

  for (const [actor, pos, inv] of queryPlayerPosInv(world)) {
    const k = xyKey(pos.x, pos.y);
    const list = itemsAt.get(k);
    if (!list || list.length === 0) continue;

    for (const itemId of list) {
      const info = world.get(itemId, ItemInfo);
      if (!info || info.type !== "currency") continue;
      const takeCount = info.count || 1;
      addToInventory(world, actor, itemId);

      emitSafe(world, 'item:pickup', { actor, itemId, count: takeCount, itemX: pos.x, itemY: pos.y });
    }
  }
}
