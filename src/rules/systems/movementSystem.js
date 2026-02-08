// src/rules/systems/movementSystem.js
// Consumes MoveIntent, applies grid-based movement with simple collision.

import { Position } from "../components/Position.js";
import { MoveIntent } from "../components/Intents/MoveIntent.js";
import { Collider } from "../components/Collider.js";
import { isWalkable } from "../environment/dungeon/tileMap.js";
import { Interactable } from "../components/Interactable.js";
import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Settings } from "../components/Settings.js";
import { InteractIntent } from "../components/Intents/InteractIntent.js";
import { AttackIntent } from "../components/Intents/AttackIntent.js";
import { Vitality } from "../components/Vitality.js";

/** @param {number} x @param {number} y */
function key(x, y) { return `${x},${y}`; }

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function movementSystem(world) {
  // Build occupancy and terrain maps for quick blocking checks
  const blocking = new Map(); // key(x,y) -> true if non-walkable terrain, solid collider, or living occupant present
  const interactables = new Map(); // key(x,y) -> entity id with Interactable
  const occupants = new Map(); // key(x,y) -> entity id (first seen) for quick bump-checks

  for (const [id, pos] of world.query(Position)) {
    const col = world.get(id, Collider);
    if (col && col.solid) {
      blocking.set(key(pos.x, pos.y), true);
    }
    // Treat any living entity as blocking by default (prevents walking through monsters)
    const vit = world.get(id, Vitality);
    if (vit && (vit.hp ?? 0) > 0) {
      blocking.set(key(pos.x, pos.y), true);
    }
    if (world.has(id, Interactable)) {
      interactables.set(key(pos.x, pos.y), id);
    }
    // record an occupant for potential bump-attack; prefer first seen
    const kk = key(pos.x, pos.y);
    if (!occupants.has(kk)) occupants.set(kk, id);
  }

  for (const [actor, intent] of world.query(MoveIntent)) {
    try {
      const pos = world.get(actor, Position);
      if (!pos) { world.remove(actor, MoveIntent); continue; }

      const nx = pos.x + (intent.dx | 0);
      const ny = pos.y + (intent.dy | 0);
      const k = key(nx, ny);

      if (!isWalkable(nx, ny) || blocking.get(k)) {
        // If there's an interactable (e.g., door), try to interact on bump instead of moving.
        const targetId = interactables.get(k);
        if (targetId) {
          world.add(actor, InteractIntent, { targetId });
        } else {
          // Cheap bump-attack: prefer a target with Vitality in the destination cell.
          let target = 0;
          for (const [eid, p] of world.query(Position)) {
            if (p.x !== nx || p.y !== ny) continue;
            // Prefer living targets
            if (world.get(eid, Vitality)) { target = eid; break; }
            // Fallback to any non-terrain occupant if no living found yet
            if (!target) target = eid;
          }
          // Only allow bump-attacks from orthogonal adjacency (no diagonals)
          const manhattan = Math.abs(intent.dx | 0) + Math.abs(intent.dy | 0);
          if (manhattan === 1 && Number.isInteger(target) && target > 0 && target !== actor) {
            try { world.add(actor, AttackIntent, { targetId: target }); } catch {}
          }
        }
        // blocked: movement is consumed
      } else {
        const from = { x: pos.x, y: pos.y };
        world.set(actor, Position, { x: nx, y: ny });
        world.emit?.("moved", { id: actor, from, to: { x: nx, y: ny } });
        // Reserve the destination so subsequent movers in this tick can't step into the same tile
        blocking.set(k, true);

        // Immediate auto-pickup for actors with Settings.autoPickup (defaults true)
        // Focused on currency to avoid unexpected heavy pickups.
        const inv = world.get(actor, Inventory);
        const set = world.get(actor, Settings);
        const enable = (set?.autoPickup !== false);
        if (inv && enable) {
          const kinds = Array.isArray(set?.autoPickupKinds) && set.autoPickupKinds.length ? set.autoPickupKinds : ["currency"];
          // collect item ids on the new tile that match types
            const toTake = [];
          for (const [itemId, ipos] of world.query(Position)) {
            if (ipos.x !== nx || ipos.y !== ny) continue;
            const info = world.get(itemId, ItemInfo);
            if (!info || !info.type || !kinds.includes(info.type)) continue;
            toTake.push(itemId);
          }
          for (const itemId of toTake) {
            const info = world.get(itemId, ItemInfo);
            if (!info) continue;
            const count = info.count || 1;
            const ident = world.get(itemId, NamedIdentity)?.identity;
            // find existing stack by identity
            let stackTarget = 0;
            for (const id of inv.items) {
              const n = world.get(id, NamedIdentity);
              if (n && n.identity === ident) { stackTarget = id; break; }
            }
            if (stackTarget) {
              world.mutate(stackTarget, ItemInfo, /** @param {any} r */ (r) => { r.count = (r.count || 1) + count; });
              world.destroy(itemId);
            } else {
              // capacity gate: allow if capacity not set or there's room
              // Special case: currency ignores capacity so monsters can hoard gold even with capacity 0
              const ignoreCapacity = info.type === 'currency';
              if (ignoreCapacity || inv.capacity == null || inv.items.length < inv.capacity) {
                try { world.remove(itemId, Position); } catch {}
                inv.items.push(itemId);
              } else {
                // no capacity — skip silently for now
              }
            }
            try { world.emit && world.emit('item:pickup', { actor, itemId, count }); } catch {}
          }
        }
      }
    } catch {}
    // Consume the intent regardless
    try { world.remove(actor, MoveIntent); } catch {}
  }
}
