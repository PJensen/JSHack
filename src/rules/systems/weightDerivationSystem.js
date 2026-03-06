/**
 * weightDerivationSystem — bottom-up weight recomputation.
 *
 * Walks each actor's inventory hierarchy and recomputes Weight.total
 * from leaves to root.  Leaf items get self = weight * count.
 * Containers get total = sum(children.total).
 *
 * Runs in effects phase, before encumbranceSystem.
 */

import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Weight } from "../components/Weight.js";
import { children } from "../../lib/ecs-js/hierarchy.js";
import { findInventoryRoot } from "../utils/inventoryFacade.js";

/**
 * Recompute Weight.total for a subtree rooted at `rootId`, bottom-up.
 */
function recomputeWeightSubtree(world, rootId) {
  // Collect post-order via iterative DFS
  const stack = [rootId];
  const order = [];
  while (stack.length) {
    const id = stack.pop();
    if (!world.isAlive(id)) continue;
    order.push(id);
    for (const c of children(world, id)) stack.push(c);
  }

  // Process leaves first (reverse of DFS push order)
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    if (!world.isAlive(id)) continue;

    // Skip entities without Weight (not part of inventory hierarchy)
    if (!world.has(id, Weight)) continue;

    // Compute self weight from ItemInfo if present
    const info = world.get(id, ItemInfo);
    const selfWeight = info
      ? (Number(info.weight) || 0) * Math.max(1, info.count | 0)
      : 0;

    // Sum children's totals
    let childTotal = 0;
    for (const c of children(world, id)) {
      const cw = world.get(c, Weight);
      if (cw) childTotal += cw.total;
    }

    world.set(id, Weight, { self: selfWeight, total: selfWeight + childTotal });
  }
}

export function weightDerivationSystem(world) {
  for (const [actorId] of world.query(Inventory)) {
    const rootId = findInventoryRoot(world, actorId);
    if (rootId > 0) recomputeWeightSubtree(world, rootId);
  }

  // Invalidate virtual caches after derivation
  if (typeof world.vclear === 'function') world.vclear();
}
