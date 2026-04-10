import { Position } from "../../rules/components/Position.js";
import { Settings } from "../../rules/components/Settings.js";
import { Interactable } from "../../rules/components/Interactable.js";
import { itemsAt } from "../../rules/utils/queries.js";

/**
 * Decide whether a walk-mode tap should be consumed and routed to rules.worldTap.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {{ id:number, pos:{x:number,y:number} }} actor
 * @param {number} tapX
 * @param {number} tapY
 * @returns {boolean}
 */
export function shouldConsumeWorldTap(world, actor, tapX, tapY) {
  if (!world || !actor?.id || !actor?.pos) return false;
  const tx = Number(tapX) | 0;
  const ty = Number(tapY) | 0;
  const px = Number(actor.pos.x) | 0;
  const py = Number(actor.pos.y) | 0;

  const set = world.get(actor.id, Settings);
  const pickupRange = Math.max(3, Number(set?.pickupRange ?? 0));
  const nearbyOffsets = [
    { x: 0, y: 0 },
    { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
    { x: 1, y: 1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: -1 },
  ];

  const hasTapPickup = nearbyOffsets.some((off) => {
    const cx = tx + (off.x | 0);
    const cy = ty + (off.y | 0);
    const dist = Math.max(Math.abs(px - cx), Math.abs(py - cy));
    return dist <= pickupRange && itemsAt(world, cx, cy).length > 0;
  });
  if (hasTapPickup) return true;

  for (const off of nearbyOffsets) {
    const cx = tx + (off.x | 0);
    const cy = ty + (off.y | 0);
    for (const [, pos, inter] of world.query(Position, Interactable)) {
      if (!inter) continue;
      if ((pos.x | 0) !== cx || (pos.y | 0) !== cy) continue;
      const dist = Math.abs(px - cx) + Math.abs(py - cy);
      if (dist <= 1) return true;
    }
  }
  return false;
}
