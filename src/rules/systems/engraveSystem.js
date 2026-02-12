import { EngraveIntent } from "../components/Intents/EngraveIntent.js";
import { Engraving } from "../components/Engraving.js";
import { Position } from "../components/Position.js";
import { NamedIdentity } from "../components/NamedIdentity.js";

/**
 * engraveSystem — consumes EngraveIntent, creates an Engraving entity
 * on the ground at the actor's current tile.
 *
 * If an engraving already exists at the same position it is overwritten
 * (the old entity is destroyed and a fresh one created).
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function engraveSystem(world) {
  for (const [actor, intent, pos] of world.query(EngraveIntent, Position)) {
    const text = String(intent.text || "").trim();
    if (!text) {
      world.remove(actor, EngraveIntent);
      continue;
    }

    // Cap length to keep things sane
    const capped = text.slice(0, 64);

    // Remove any existing engraving at this tile
    for (const [eid, , epos] of world.query(Engraving, Position)) {
      if (epos.x === pos.x && epos.y === pos.y) {
        try { world.destroy(eid); } catch { /* already gone */ }
      }
    }

    // Spawn a new engraving entity
    const id = world.create();
    world.add(id, Position, { x: pos.x, y: pos.y });
    world.add(id, Engraving, { text: capped, author: actor, turn: world.step | 0 });
    world.add(id, NamedIdentity, { name: capped, identity: "engraving" });

    try {
      world.emit && world.emit("engrave", {
        actor,
        engravingId: id,
        text: capped,
        x: pos.x,
        y: pos.y,
      });
    } catch { /* listener threw */ }

    world.remove(actor, EngraveIntent);
  }
}
