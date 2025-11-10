import { defineArchetype, createFrom } from "../../lib/ecs-js/archetype.js";
import { Position } from "../components/Position.js";
import { Player } from "../components/Player.js";
import { Inventory } from "../components/Inventory.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Physiology } from "../components/Physiology.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { Vitality } from "../components/Vitality.js";
import { Settings } from "../components/Settings.js";
import { Equipment } from "../components/Equipment.js";
import { Mana } from "../components/Mana.js";
import { Brain, createSeenTilesBuffer } from "../components/Brain.js";
import { Collider } from "../components/Collider.js";
import { BoundingCircle } from "../components/BoundingCircle.js";
import { Facing } from "../components/Facing.js";
import { Anatomy, buildHumanoidAnatomy } from "../components/Anatomy.js";

export const PlayerArchetype = defineArchetype(
  "PlayerArchetype",
  [Player],
  [Position, (p) => ({ x: p.x ?? 0, y: p.y ?? 0 })],
  [Inventory, (p) => ({ capacity: p.capacity ?? 20, weightLimit: p.weightLimit ?? null, items: [] })],
  [NamedIdentity, (p) => ({ name: p.name ?? "Player", identity: p.identity ?? "player" })],
  [Physiology, (p) => ({ sizeClass: p.sizeClass ?? "M", massKg: p.massKg ?? 80 })],
  // Slightly slimmer default radius so the player can navigate 1-tile corridors.
  [BoundingCircle, (p) => ({ radius: p.radius ?? 0.45 })],
  [Facing, (p) => {
    const fx = Number.isFinite(p.facing?.x) ? p.facing.x : 1;
    const fy = Number.isFinite(p.facing?.y) ? p.facing.y : 0;
    const mag = Math.hypot(fx, fy) || 1;
    return { x: fx / mag, y: fy / mag };
  }],
  [Anatomy, (p) => ({
    parts: Array.isArray(p.anatomy?.parts) ? p.anatomy.parts : buildHumanoidAnatomy(),
    strideDistance: Number.isFinite(p.strideDistance) ? p.strideDistance : (Number.isFinite(p.anatomy?.strideDistance) ? p.anatomy.strideDistance : 1),
    reachDistance: Number.isFinite(p.reachDistance) ? p.reachDistance : (Number.isFinite(p.anatomy?.reachDistance) ? p.anatomy.reachDistance : 1.25),
  })],
  [ActiveEffects, { effects: [] }],
  [Vitality, (p) => ({ maxHp: p.maxHp ?? 10, hp: p.hp ?? (p.maxHp ?? 10) })],
  // Make player a solid collider so others cannot move through and vice versa
  [Collider, (p) => ({ solid: p.solid ?? true, blocksSight: p.blocksSight ?? false })],
  [Settings, (p) => ({ autoPickup: p.autoPickup ?? true, autoPickupKinds: p.autoPickupKinds ?? ['currency'] })],
  [Equipment, {}],
  [Mana, {}],
  [Brain, (p) => {
    const requestedSize = Number.isFinite(p.seenTilesSize) ? p.seenTilesSize : 0;
    return { seenTiles: createSeenTilesBuffer(requestedSize) };
  }]
);

export function createPlayer(world, params = {}) {
  return createFrom ? createFrom(world, PlayerArchetype, params) : (()=>{
    const id = world.create();
    world.add(id, Player);
    world.add(id, Position, { x: params.x ?? 0, y: params.y ?? 0 });
    world.add(id, Inventory, { capacity: params.capacity ?? 20, weightLimit: params.weightLimit ?? null, items: [] });
    world.add(id, NamedIdentity, { name: params.name ?? "Player", identity: params.identity ?? "player" });
    world.add(id, Physiology, { sizeClass: params.sizeClass ?? "M", massKg: params.massKg ?? 80 });
    world.add(id, BoundingCircle, { radius: params.radius ?? 0.45 });
    const fx = Number.isFinite(params.facing?.x) ? params.facing.x : 1;
    const fy = Number.isFinite(params.facing?.y) ? params.facing.y : 0;
    const mag = Math.hypot(fx, fy) || 1;
    world.add(id, Facing, { x: fx / mag, y: fy / mag });
    const stride = Number.isFinite(params.strideDistance) ? params.strideDistance : 1;
    const reach = Number.isFinite(params.reachDistance) ? params.reachDistance : 1.25;
    world.add(id, Anatomy, { parts: buildHumanoidAnatomy(), strideDistance: stride, reachDistance: reach });
    world.add(id, Equipment, {});
    world.add(id, ActiveEffects, { effects: [] });
    world.add(id, Vitality, { maxHp: params.maxHp ?? 10, hp: params.hp ?? (params.maxHp ?? 10) });
    world.add(id, Settings, { autoPickup: params.autoPickup ?? true, autoPickupKinds: params.autoPickupKinds ?? ['currency'] });
    world.add(id, Mana, { maxMana: 50, mana: 50, regenRate: 1 });
    world.add(id, Brain, { seenTiles: createSeenTilesBuffer() });
    return id;
  })();
}
