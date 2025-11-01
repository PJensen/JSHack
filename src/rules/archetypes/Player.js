import { defineArchetype, createFrom } from "../../lib/ecs-js/archetype.js";
import { Position } from "../components/Position.js";
import { Player } from "../components/Player.js";
import { Inventory } from "../components/Inventory.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Physiology } from "../components/Physiology.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { Vitality } from "../components/Vitality.js";

export const PlayerArchetype = defineArchetype(
  "PlayerArchetype",
  [Player],
  [Position, (p) => ({ x: p.x ?? 0, y: p.y ?? 0 })],
  [Inventory, (p) => ({ capacity: p.capacity ?? 20, weightLimit: p.weightLimit ?? null, items: [] })],
  [NamedIdentity, (p) => ({ name: p.name ?? "Player", identity: p.identity ?? "player" })],
  [Physiology, (p) => ({ sizeClass: p.sizeClass ?? "M", massKg: p.massKg ?? 80 })],
  [ActiveEffects, { effects: [] }],
  [Vitality, (p) => ({ maxHp: p.maxHp ?? 10, hp: p.hp ?? (p.maxHp ?? 10) })]
);

export function createPlayer(world, params = {}) {
  return createFrom ? createFrom(world, PlayerArchetype, params) : (()=>{
    const id = world.create();
    world.add(id, Player);
    world.add(id, Position, { x: params.x ?? 0, y: params.y ?? 0 });
    world.add(id, Inventory, { capacity: params.capacity ?? 20, weightLimit: params.weightLimit ?? null, items: [] });
    world.add(id, NamedIdentity, { name: params.name ?? "Player", identity: params.identity ?? "player" });
    world.add(id, Physiology, { sizeClass: params.sizeClass ?? "M", massKg: params.massKg ?? 80 });
    return id;
  })();
}
