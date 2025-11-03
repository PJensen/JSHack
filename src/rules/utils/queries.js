import { Position } from "../components/Position.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Player } from "../components/Player.js";

export function itemsAt(world, x, y) {
  const ids = [];
  // Mirror rendering access pattern: scan all Position holders, then filter by ItemInfo
  for (const [id, pos] of world.query(Position)) {
    if (!pos || pos.x !== x || pos.y !== y) continue;
    if (world.has(id, ItemInfo)) ids.push(id);
  }
  return ids;
}

export function playerEntity(world) {
  // Query order must match destructuring: ensure Position is the second tuple value
  for (const [id, _pl, pos] of world.query(Player, Position)) {
    if (pos && Number.isInteger(pos.x) && Number.isInteger(pos.y)) {
      return { id, pos: { x: pos.x, y: pos.y } };
    }
  }
  return null;
}
