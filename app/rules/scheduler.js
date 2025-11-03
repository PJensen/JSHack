// app/rules/scheduler.js
// Register rules systems into phases and set the world scheduler.

import { composeScheduler, registerSystem, clearSystems, getOrderedSystems } from "../../src/lib/ecs-js/index.js";
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
import { combatSystem } from "../../src/rules/systems/combatSystem.js";
import { installAffixTriggers } from "../../src/rules/systems/affixTriggerSystem.js";

export function configureWorld(world) {
  clearSystems();

  // Install affix event listeners once per world
  installAffixTriggers(world);

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
  registerSystem(combatSystem, 'intents');
  // Run pickup after movement so stepping onto items can pick them up immediately
  registerSystem(itemPickupSystem, 'intents');

  // Phase: effects (derived first, then per-turn effects)
  registerSystem(equipmentSystem, 'effects');
  registerSystem(effectSystem, 'effects');
  // Post-move auto-pickup runs after intents, within the same tick
  registerSystem(autoPickupPostMoveSystem, 'effects');

  // Compose scheduler: order of phases matters
  const baseScheduler = composeScheduler('intents', 'effects');
  const profEnabled = shouldProfileRules();
  if (!profEnabled) {
    world.setScheduler(baseScheduler);
    return;
  }

  // Build profiled scheduler: measure per system and per phase using high-res timer
  const phases = ['intents', 'effects'];
  const phaseSystems = Object.create(null);
  for (const ph of phases) phaseSystems[ph] = getOrderedSystems(ph);

  world.setScheduler((w, dt) => {
    const perf = getRulesProfilerState();
    const tick = { phases: {}, totalMs: 0 };
    let tickStart = performance.now();

    for (const ph of phases) {
      const list = phaseSystems[ph];
      let phStart = performance.now();
      const sysTimes = [];
      for (let i = 0; i < list.length; i++) {
        const fn = list[i];
        const s0 = performance.now();
        fn(w, dt);
        const s1 = performance.now();
        sysTimes.push({ name: fn.name || `sys${i}`, ms: s1 - s0 });
      }
      const phEnd = performance.now();
      tick.phases[ph] = { totalMs: phEnd - phStart, systems: sysTimes };
    }

    tick.totalMs = performance.now() - tickStart;
    perf.lastTick = tick;
  });
}

function shouldProfileRules() {
  const params = new URLSearchParams(window.location.search || '');
  const v = (params.get('rulesProfile') || (typeof localStorage !== 'undefined' ? localStorage.getItem('jshack.rulesProfile') : '0') || '0');
  return v === '1' || v === 'true' || v === 'on';
}

function getRulesProfilerState() {
  const w = /** @type any */(window);
  return (w.__JSHACK_RULES_PROF ||= { enabled: true, lastTick: null });
}
