// app/rules/scheduler.js
// Register rules systems into phases and set the world scheduler.

import { composeScheduler, registerSystem, clearSystems } from "../../src/lib/ecs-js/index.js";
import { drinkSystem } from "../../src/rules/systems/drinkSystem.js";
import { itemPickupSystem } from "../../src/rules/systems/itemPickupSystem.js";
import { itemDropSystem } from "../../src/rules/systems/itemDropSystem.js";
import { interactionSystem } from "../../src/rules/systems/interactionSystem.js";
import { projectileSystem } from "../../src/rules/systems/projectileSystem.js";
import { effectSystem } from "../../src/rules/systems/effectSystem.js";
import { waitSystem } from "../../src/rules/systems/waitSystem.js";
import { castSpellSystem } from "../../src/rules/systems/castSpellSystem.js";

export function configureWorld(world) {
  // Optional: clear previous registry on hot reload
  try { clearSystems(); } catch {}

  // Phase: intents (consume queued intents)
  registerSystem(waitSystem, 'intents');
  registerSystem(drinkSystem, 'intents');
  registerSystem(itemPickupSystem, 'intents');
  registerSystem(itemDropSystem, 'intents');
  registerSystem(interactionSystem, 'intents');
  registerSystem(projectileSystem, 'intents');
  registerSystem(castSpellSystem, 'intents');

  // Phase: effects (per-turn effects resolution)
  registerSystem(effectSystem, 'effects');

  // Compose scheduler: order of phases matters
  world.setScheduler(composeScheduler('intents', 'effects'));
}
