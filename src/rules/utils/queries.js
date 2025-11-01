import { Position } from "../components/Position.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Player } from "../components/Player.js";

export function itemsAt(world, x, y) {
  const ids = [];
  for (const [id, pos] of world.query(Position, { where: (p)=> !!p, project: (i,p)=> [i,p] })) {
    if (pos.x === x && pos.y === y && world.has(id, ItemInfo)) ids.push(id);
  }
  return ids;
}

export function playerEntity(world) {
  for (const [id, pos] of world.query(Player, Position)) {
    return { id, pos: { x: pos.x, y: pos.y } };
  }
  return null;
}
