// src/rules/systems/spellCooldownSystem.js
// Ticks down player spell cooldowns once per world step.
import { tickSpellCooldowns } from "../utils/spellCooldowns.js";

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function spellCooldownSystem(world) {
  tickSpellCooldowns(world);
}
