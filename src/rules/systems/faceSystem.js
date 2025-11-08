import { FaceIntent } from "../components/Intents/FaceIntent.js";
import { Facing } from "../components/Facing.js";
import { Position } from "../components/Position.js";

const EPS = 1e-5;

/** @param {import("../../lib/ecs-js").World} world */
export function faceSystem(world) {
  for (const [actor, intent] of world.query(FaceIntent)) {
    try {
      let dx = Number.isFinite(intent.dx) ? intent.dx : 0;
      let dy = Number.isFinite(intent.dy) ? intent.dy : 0;
      if (Math.abs(dx) < EPS && Math.abs(dy) < EPS) {
        const pos = world.get(actor, Position);
        const tx = Number.isFinite(intent.toX) ? intent.toX : null;
        const ty = Number.isFinite(intent.toY) ? intent.toY : null;
        if (pos && tx != null && ty != null) {
          dx = tx - pos.x;
          dy = ty - pos.y;
        }
      }
      const mag = Math.hypot(dx, dy);
      if (mag > EPS) {
        const dir = { x: dx / mag, y: dy / mag };
        if (world.has(actor, Facing)) {
          world.set(actor, Facing, dir);
        } else {
          try { world.add(actor, Facing, dir); } catch {}
        }
        try { world.emit && world.emit("faced", { id: actor, facing: dir }); } catch {}
      }
    } catch {}
    try { world.remove(actor, FaceIntent); } catch {}
  }
}
