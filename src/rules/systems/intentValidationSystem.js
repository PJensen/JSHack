// rules/systems/intentValidationSystem.js
// Pre-validation pass that strips intents from actors who cannot act.
// Runs first in the 'intents' phase so downstream systems can assume valid actors.
//
// Currently strips intents for:
//   - Dead actors (hp <= 0)
//   - Stunned actors (have "stunned" status)

import { Vitality } from "../components/Vitality.js";
import { MoveIntent } from "../components/Intents/MoveIntent.js";
import { AttackIntent } from "../components/Intents/AttackIntent.js";
import { WaitIntent } from "../components/Intents/WaitIntent.js";
import { DrinkIntent } from "../components/Intents/DrinkIntent.js";
import { UseIntent } from "../components/Intents/UseIntent.js";
import { ThrowIntent } from "../components/Intents/ThrowIntent.js";
import { ApplyIntent } from "../components/Intents/ApplyIntent.js";
import { EquipIntent } from "../components/Intents/EquipIntent.js";
import { DropIntent } from "../components/Intents/DropIntent.js";
import { PickupIntent } from "../components/Intents/PickupIntent.js";
import { CastSpellIntent } from "../components/Intents/CastSpellIntent.js";
import { RangedAttackIntent } from "../components/Intents/RangedAttackIntent.js";
import { EngraveIntent } from "../components/Intents/EngraveIntent.js";
import { PrayIntent } from "../components/Intents/PrayIntent.js";
import { DisarmIntent } from "../components/Intents/DisarmIntent.js";
import { InteractIntent } from "../components/Intents/InteractIntent.js";
import { statusStrength } from "../utils/statusFacade.js";

/** All intent components that should be stripped when an actor cannot act. */
const ALL_INTENTS = [
  MoveIntent, AttackIntent, WaitIntent, DrinkIntent, UseIntent,
  ThrowIntent, ApplyIntent, EquipIntent, DropIntent, PickupIntent,
  CastSpellIntent, RangedAttackIntent, EngraveIntent, PrayIntent,
  DisarmIntent, InteractIntent,
];

/**
 * Remove all intent components from an entity.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} id
 */
function stripAllIntents(world, id) {
  for (let i = 0; i < ALL_INTENTS.length; i++) {
    if (world.has(id, ALL_INTENTS[i])) {
      try { world.remove(id, ALL_INTENTS[i]); } catch {}
    }
  }
}

/**
 * Intent validation system — runs first in the intents phase.
 * Strips all intents from actors who are dead or stunned so downstream
 * systems never process actions for incapacitated entities.
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function intentValidationSystem(world) {
  for (const [id, vit] of world.query(Vitality)) {
    // Dead actors cannot act
    if (vit.hp <= 0) {
      stripAllIntents(world, id);
      continue;
    }

    // Stunned actors lose their turn
    if (statusStrength(world, id, "stunned") > 0) {
      stripAllIntents(world, id);
      try {
        world.emit?.("intent:blocked", { actor: id, reason: "stunned" });
      } catch (e) {
        console.debug("[intentValidationSystem] emit intent:blocked failed:", e);
      }
    }
  }
}
