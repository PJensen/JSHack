// app/rules/scheduler.js
// Register rules systems into phases and set the world scheduler.

import { composeScheduler, registerSystem, clearSystems } from "../../src/lib/ecs-js/index.js";
import { drinkSystem } from "../../src/rules/systems/drinkSystem.js";
import { itemPickupSystem, autoPickupPostMoveSystem } from "../../src/rules/systems/itemPickupSystem.js";
import { itemDropSystem } from "../../src/rules/systems/itemDropSystem.js";
import { projectileSystem } from "../../src/rules/systems/projectileSystem.js";
import { interactionSystem } from "../../src/rules/systems/interactionSystem.js";
import { effectSystem } from "../../src/rules/systems/effectSystem.js";
import { equipmentSystem } from "../../src/rules/systems/equipmentSystem.js";
import { waitSystem } from "../../src/rules/systems/waitSystem.js";
import { castSpellSystem } from "../../src/rules/systems/castSpellSystem.js";
import { aiChaseSystem } from "../../src/rules/systems/aiChaseSystem.js";
import { movementSystem } from "../../src/rules/systems/movementSystem.js";

export function configureWorld(world) {
  // Optional: clear previous registry on hot reload
  try { clearSystems(); } catch {}

  // Phase: intents (consume queued intents)
  // Producers first (AI), then consumers (movement, interactions, etc.)
  registerSystem(aiChaseSystem, 'intents');
  registerSystem(waitSystem, 'intents');
  registerSystem(drinkSystem, 'intents');
  registerSystem(itemDropSystem, 'intents');
  registerSystem(projectileSystem, 'intents');
  registerSystem(interactionSystem, 'intents');
  registerSystem(castSpellSystem, 'intents');
  registerSystem(movementSystem, 'intents');
  // Run pickup after movement so stepping onto items can pick them up immediately
  registerSystem(itemPickupSystem, 'intents');

  // Phase: effects (derived first, then per-turn effects)
  registerSystem(equipmentSystem, 'effects');
  registerSystem(effectSystem, 'effects');
  // Post-move auto-pickup runs after intents, within the same tick
  registerSystem(autoPickupPostMoveSystem, 'effects');

  // Compose scheduler: order of phases matters
  world.setScheduler(composeScheduler('intents', 'effects'));
}
