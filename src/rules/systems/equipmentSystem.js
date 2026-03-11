// src/rules/systems/equipmentSystem.js
// Compatibility mirror: passive bonuses now resolve from passiveBonuses.js.

import { Equipment } from '../components/Equipment.js';
import { getPassiveBonuses } from '../utils/passiveBonuses.js';

export function equipmentSystem(world) {
  for (const [id, eq] of world.query(Equipment)) {
    const next = getPassiveBonuses(world, id);
    Object.assign(eq, next);
  }
}
