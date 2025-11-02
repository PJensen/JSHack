// src/rules/systems/autoPickupSystem.js
// Automatically pick up currency stacks (e.g., gold) when the player stands on them.
// Deterministic, rules-side. Kept focused to currency to minimize behavioral impact.

import { Position } from "../components/Position.js";
import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Player } from "../components/Player.js";

export function autoPickupSystem(world) {
  // Build a lookup from tile -> item ids for currency only
  const itemsAt = new Map(); // "x,y" -> [id]
  for (const [id, pos] of world.query(Position)) {
    const info = world.get(id, ItemInfo);
    if (!info || info.type !== "currency") continue;
    const k = key(pos.x, pos.y);
    let arr = itemsAt.get(k);
    if (!arr) itemsAt.set(k, (arr = []));
    arr.push(id);
  }

  for (const [actor, pos, inv] of world.query(Player, Position, Inventory)) {
    const k = key(pos.x, pos.y);
    const list = itemsAt.get(k);
    if (!list || list.length === 0) continue;

    for (const itemId of list) {
      const info = world.get(itemId, ItemInfo);
      const name = world.get(itemId, NamedIdentity);
      if (!info || info.type !== "currency") continue;
      const takeCount = info.count || 1;

      // Try to stack into existing gold stack if present
      const stackTarget = findStackTarget(world, inv, name?.identity);
      if (stackTarget) {
        world.mutate(stackTarget, ItemInfo, (r) => { r.count = (r.count || 1) + takeCount; });
        world.destroy(itemId);
      } else {
        // Move the whole stack into inventory as-is
        try { world.remove(itemId, Position); } catch {}
        inv.items.push(itemId);
      }

      try { world.emit && world.emit('item:pickup', { actor, itemId, count: takeCount }); } catch {}
    }
  }
}

function key(x, y) { return `${x},${y}`; }

function findStackTarget(world, inv, identity) {
  if (!identity) return 0;
  for (const id of inv.items) {
    const n = world.get(id, NamedIdentity);
    if (n && n.identity === identity) return id;
  }
  return 0;
}
