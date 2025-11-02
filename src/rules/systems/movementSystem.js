// src/rules/systems/movementSystem.js
// Consumes MoveIntent, applies grid-based movement with simple collision.

import { Position } from "../components/Position.js";
import { MoveIntent } from "../components/Intents/MoveIntent.js";
import { Terrain } from "../components/Terrain.js";
import { Collider } from "../components/Collider.js";
import { Interactable } from "../components/Interactable.js";
import { InteractIntent } from "../components/Intents/InteractIntent.js";

function key(x, y) { return `${x},${y}`; }

export function movementSystem(world) {
  // Build occupancy and terrain maps for quick blocking checks
  const blocking = new Map(); // key(x,y) -> true if non-walkable terrain or solid collider present
  const interactables = new Map(); // key(x,y) -> entity id with Interactable

  for (const [id, pos] of world.query(Position)) {
    const ter = world.get(id, Terrain);
    if (ter && !ter.walkable) {
      blocking.set(key(pos.x, pos.y), true);
    }
    const col = world.get(id, Collider);
    if (col && col.solid) {
      blocking.set(key(pos.x, pos.y), true);
    }
    if (world.has(id, Interactable)) {
      interactables.set(key(pos.x, pos.y), id);
    }
  }

  for (const [actor, intent] of world.query(MoveIntent)) {
    try {
      const pos = world.get(actor, Position);
      if (!pos) { world.remove(actor, MoveIntent); continue; }

      const nx = pos.x + (intent.dx | 0);
      const ny = pos.y + (intent.dy | 0);
      const k = key(nx, ny);

      if (blocking.get(k)) {
        // If there's an interactable (e.g., door), try to interact on bump instead of moving.
        const targetId = interactables.get(k);
        if (targetId) {
          world.add(actor, InteractIntent, { targetId });
        }
        // blocked: do nothing (no movement)
      } else {
        const from = { x: pos.x, y: pos.y };
        world.set(actor, Position, { x: nx, y: ny });
        world.emit?.("moved", { id: actor, from, to: { x: nx, y: ny } });
      }
    } catch {}
    // Consume the intent regardless
    try { world.remove(actor, MoveIntent); } catch {}
  }
}
