import { defineComponent } from "../../lib/ecs-js/index.js";

export const GEAR_SLOTS = Object.freeze([
  "weapon", "armor", "shield", "ring1", "ring2", "ammo", "ranged", "feet",
]);

export const GEAR_SLOT_SET = Object.freeze(new Set(GEAR_SLOTS));

/**
 * Resolve the equipped slot name for a specific item id.
 * @param {any} equipment
 * @param {number} itemId
 * @returns {string|null}
 */
export function getEquippedSlot(equipment, itemId) {
  if (!equipment || !Number.isInteger(itemId) || itemId <= 0) return null;
  for (const slot of GEAR_SLOTS) {
    if (equipment[slot] === itemId) return slot;
  }
  return null;
}

export const Equipment = defineComponent('Equipment', {
  weapon: null,
  armor: null,
  shield: null,
  ring1: null,
  ring2: null,
  ammo: null,
  ranged: null,
  feet: null,
  attackDerived: 0,
  defenseDerived: 0,
  maxHpDerived: 0,
  critChanceDerived: 0,
  critMultDerived: 0,
  manaRegenDerived: 0,
  maxManaDerived: 0,
  staminaRegenDerived: 0,
  maxStaminaDerived: 0,
  kineticDRDerived: 0,
  fireResistDerived: 0,
  poisonResistDerived: 0,
  acidResistDerived: 0,
  radiationResistDerived: 0,
  electricOhmsDerived: 0,
  bluntResistDerived: 0,
  slashResistDerived: 0,
  pierceResistDerived: 0,
  luckDerived: 0,
  naturalDamageDice: null,
  naturalScript: null
});
