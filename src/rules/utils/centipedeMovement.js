// rules/utils/centipedeMovement.js
// Body-cascade listener: when a centipede segment moves, each following
// segment slides into the previous segment's old position (snake-game style).

import { Position } from "../components/Position.js";
import { CentipedeSegment } from "../components/CentipedeSegment.js";

const INSTALLED = Symbol.for("jshack:centipede:bodyMovement:installed");

/**
 * Install once per world.  Listens to "moved" events and cascades
 * body segment positions along the chain.
 * @param {any} world
 */
export function installCentipedeBodyCascade(world) {
  if (!world || world[INSTALLED]) return;
  world[INSTALLED] = true;

  world.on("moved", ({ id, from }) => {
    const seg = world.get(id, CentipedeSegment);
    if (!seg) return;

    // Walk the chain from this segment toward the tail, sliding each
    // segment into the previous segment's vacated position.
    let nextId = seg.nextId;
    let prevPos = { x: from.x | 0, y: from.y | 0 };

    while (nextId && world.isAlive(nextId)) {
      const nextSeg = world.get(nextId, CentipedeSegment);
      if (!nextSeg) break;

      const nextPos = world.get(nextId, Position);
      if (!nextPos) break;

      const oldPos = { x: nextPos.x | 0, y: nextPos.y | 0 };

      // Direct position set — no MoveIntent, no "moved" event re-emission
      // to avoid infinite cascade loops and collision conflicts.
      world.set(nextId, Position, { x: prevPos.x, y: prevPos.y });

      prevPos = oldPos;
      nextId = nextSeg.nextId;
    }
  });
}
