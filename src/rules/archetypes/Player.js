import { defineArchetype, createFrom } from "../../lib/ecs-js/archetype.js";
import { Position } from "../components/Position.js";
import { Player } from "../components/Player.js";
import { Inventory } from "../components/Inventory.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Physiology } from "../components/Physiology.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { Vitality } from "../components/Vitality.js";
import { Resistances } from "../components/Resistences.js";
import { Settings } from "../components/Settings.js";
import { Equipment } from "../components/Equipment.js";
import { Mana } from "../components/Mana.js";
import { Stamina } from "../components/Stamina.js";
import { Brain } from "../components/Brain.js";
import { Collider } from "../components/Collider.js";
import { Facing } from "../components/Facing.js";
import { Score } from "../components/Score.js";

export const PlayerArchetype = defineArchetype(
  "PlayerArchetype",
  [Player],
  [Position, (p) => ({ x: p.x ?? 0, y: p.y ?? 0 })],
  [Inventory, (p) => ({ capacity: p.capacity ?? 20, weightLimit: p.weightLimit ?? 50, items: [] })],
  [NamedIdentity, (p) => ({ name: p.name ?? "Player", identity: p.identity ?? "player" })],
  [Physiology, (p) => ({ sizeClass: p.sizeClass ?? "M", massKg: p.massKg ?? 80 })],
  [Resistances, (p) => ({
    kinetic: { DR: 4, bluntMult: 1.0, slashMult: 1.0, pierceMult: 1.0, ...(p.resistances?.kinetic ?? {}) },
    thermal: { igniteC: Infinity, burnMult: 1.0, ...(p.resistances?.thermal ?? {}) },
    chemical: { acidMult: 1.0, baseMult: 1.0, solventMult: 1.0, toxMult: 1.0, ...(p.resistances?.chemical ?? {}) },
    electric: { ohms: 1200, fibrillationA: 0.03, ...(p.resistances?.electric ?? {}) },
    radiation: { alpha: 1.0, beta: 1.0, gamma: 1.0, neutron: 1.0, ...(p.resistances?.radiation ?? {}) },
  })],
  [ActiveEffects, { effects: [] }],
  [Vitality, (p) => ({ maxHp: p.maxHp ?? 20, hp: p.hp ?? (p.maxHp ?? 20) })],
  // Make player a solid collider so others cannot move through and vice versa
  [Collider, (p) => ({ solid: p.solid ?? true, blocksSight: p.blocksSight ?? false })],
  [Settings, (p) => ({ autoPickup: p.autoPickup ?? true, autoPickupKinds: p.autoPickupKinds ?? ['currency'] })],
  [Equipment, {}],
  [Mana, {}],
  [Stamina, (p) => ({ maxStamina: p.maxStamina ?? 100, stamina: p.stamina ?? 100, staminaRegen: p.staminaRegen ?? 2.0 })],
  [Brain, {}],
  [Facing, { dx: 0, dy: 0 }],
  [Score, {}]
);

export function createPlayer(world, params = {}) {
  return createFrom ? createFrom(world, PlayerArchetype, params) : (()=>{
    const id = world.create();
    world.add(id, Player);
    world.add(id, Position, { x: params.x ?? 0, y: params.y ?? 0 });
    world.add(id, Inventory, { capacity: params.capacity ?? 20, weightLimit: params.weightLimit ?? 50, items: [] });
    world.add(id, NamedIdentity, { name: params.name ?? "Player", identity: params.identity ?? "player" });
    world.add(id, Physiology, { sizeClass: params.sizeClass ?? "M", massKg: params.massKg ?? 80 });
    world.add(id, Resistances, {
      kinetic: { DR: 4, bluntMult: 1.0, slashMult: 1.0, pierceMult: 1.0, ...(params.resistances?.kinetic ?? {}) },
      thermal: { igniteC: Infinity, burnMult: 1.0, ...(params.resistances?.thermal ?? {}) },
      chemical: { acidMult: 1.0, baseMult: 1.0, solventMult: 1.0, toxMult: 1.0, ...(params.resistances?.chemical ?? {}) },
      electric: { ohms: 1200, fibrillationA: 0.03, ...(params.resistances?.electric ?? {}) },
      radiation: { alpha: 1.0, beta: 1.0, gamma: 1.0, neutron: 1.0, ...(params.resistances?.radiation ?? {}) },
    });
    world.add(id, Equipment, {});
    world.add(id, ActiveEffects, { effects: [] });
    world.add(id, Vitality, { maxHp: params.maxHp ?? 20, hp: params.hp ?? (params.maxHp ?? 20) });
    world.add(id, Settings, { autoPickup: params.autoPickup ?? true, autoPickupKinds: params.autoPickupKinds ?? ['currency'] });
    world.add(id, Mana, { maxMana: 50, mana: 50, regenRate: 1 });
    world.add(id, Stamina, { maxStamina: 100, stamina: 100, staminaRegen: 2.0 });
    world.add(id, Score, {});
    return id;
  })();
}
