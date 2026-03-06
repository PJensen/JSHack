import { Lifespan } from "../components/Lifespan.js";
import { Position } from "../components/Position.js";
import { Inventory } from "../components/Inventory.js";
import { destroyInventoryRoot } from "../utils/inventoryFacade.js";

/**
 * Ticks down Lifespan.turnsLeft and destroys the entity when it expires.
 *
 * Phase: cleanup (runs before spatialIndexSystem so the dead entity is
 * removed from the index in the same tick).
 *
 * When onExpiry === "emit", the named event is emitted with
 * { id, at: {x, y} | null } before destruction, giving display and rules
 * listeners a chance to react (spawn VFX, drop items, etc.).
 */
export function lifespanSystem(world) {
  for (const [id, ls] of world.query(Lifespan)) {
    ls.turnsLeft--;
    if (ls.turnsLeft > 0) continue;

    if (ls.onExpiry === "emit" && ls.expiryEvent) {
      const pos = world.get(id, Position);
      try {
        world.emit?.(ls.expiryEvent, {
          id,
          at: pos ? { x: pos.x | 0, y: pos.y | 0 } : null,
        });
      } catch { /* */ }
    }

    if (world.has(id, Inventory)) destroyInventoryRoot(world, id);
    world.destroy(id);
  }
}
