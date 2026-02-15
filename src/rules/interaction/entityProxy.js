// rules/interaction/entityProxy.js
// Reflective read-only proxy for ECS entities.
// Gives callbacks an OOP feel without OOP consequences.
//
// Usage:
//   ctx.actor.hp        // lazy read-through of Vitality.hp
//   ctx.actor.identity  // lazy read-through of NamedIdentity.identity
//   ctx.actor.statuses  // lazy read-through of Status.statuses
//   ctx.actor.hp = 10   // throws — no direct mutation

import { ActiveEffects } from "../components/ActiveEffects.js";
import { Equipment } from "../components/Equipment.js";
import { Faction } from "../components/Faction.js";
import { Hunger } from "../components/Hunger.js";
import { Inventory } from "../components/Inventory.js";
import { Mana } from "../components/Mana.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Position } from "../components/Position.js";
import { Resistances } from "../components/Resistences.js";
import { Stamina } from "../components/Stamina.js";
import { Status } from "../components/Status.js";
import { Vitality } from "../components/Vitality.js";

/**
 * Property-to-component mapping.
 * Each entry: [Component, fieldName]
 * Read is lazy: component fetched from world on first access per property.
 */
const PROP_MAP = {
  // Vitality
  hp:       [Vitality, "hp"],
  maxHp:    [Vitality, "maxHp"],

  // Equipment (derived stats)
  attackDerived:    [Equipment, "attackDerived"],
  defenseDerived:   [Equipment, "defenseDerived"],
  maxHpDerived:     [Equipment, "maxHpDerived"],
  critChanceDerived:[Equipment, "critChanceDerived"],
  critMultDerived:  [Equipment, "critMultDerived"],
  weapon:           [Equipment, "weapon"],
  armor:            [Equipment, "armor"],

  // Status
  statuses: [Status, "statuses"],

  // NamedIdentity
  name:     [NamedIdentity, "name"],
  identity: [NamedIdentity, "identity"],

  // Position
  x: [Position, "x"],
  y: [Position, "y"],

  // Hunger
  hunger:    [Hunger, "hunger"],
  satiation: [Hunger, "satiation"],

  // Stamina
  stamina:    [Stamina, "stamina"],
  maxStamina: [Stamina, "maxStamina"],

  // Mana
  mana:     [Mana, "mana"],
  maxMana:  [Mana, "maxMana"],

  // Faction
  faction: [Faction, "key"],

  // Inventory
  items: [Inventory, "items"],

  // Resistances (whole component)
  resistances: [Resistances, null],

  // ActiveEffects
  effects: [ActiveEffects, "effects"],
};

/**
 * Create a read-only reflective proxy for an ECS entity.
 * Reads are lazy (component fetched on property access).
 * Writes throw TypeError.
 *
 * @param {any} world — ECS world
 * @param {number} entityId
 * @returns {Proxy}
 */
export function createEntityProxy(world, entityId) {
  return new Proxy(Object.freeze({ id: entityId }), {
    get(_target, prop) {
      if (prop === "id") return entityId;
      if (prop === Symbol.toPrimitive) return () => entityId;
      if (prop === "toString") return () => `Entity(${entityId})`;

      const mapping = PROP_MAP[/** @type string */ (prop)];
      if (!mapping) return undefined;

      const [Component, field] = mapping;
      const comp = world.get(entityId, Component);
      if (!comp) return undefined;
      return field === null ? comp : comp[field];
    },
    set(_target, prop) {
      throw new TypeError(`Cannot set '${String(prop)}' on entity proxy — mutations must go through ctx`);
    },
  });
}
