// src/main/scheduler.js
// Register rules systems into phases and set the world scheduler.

import { composeScheduler, registerSystem, clearSystems, getOrderedSystems } from "../lib/ecs-js/index.js";
/** @typedef {import('../lib/ecs-js/index.js').World} World */
import { drinkSystem } from "../rules/systems/drinkSystem.js";
import { itemPickupSystem, autoPickupPostMoveSystem } from "../rules/systems/itemPickupSystem.js";
import { itemDropSystem } from "../rules/systems/itemDropSystem.js";
import { equipItemSystem } from "../rules/systems/equipItemSystem.js";
import { useItemSystem } from "../rules/systems/useItemSystem.js";
import { rangedAttackSystem } from "../rules/systems/rangedAttackSystem.js";
import { interactionSystem } from "../rules/systems/interactionSystem.js";
import { effectSystem } from "../rules/systems/effectSystem.js";
import { equipmentSystem } from "../rules/systems/equipmentSystem.js";
import { waitSystem } from "../rules/systems/waitSystem.js";
import { castSpellSystem } from "../rules/systems/castSpellSystem.js";
import { aiChaseSystem } from "../rules/systems/aiChaseSystem.js";
import { petFollowSystem } from "../rules/systems/petFollowSystem.js";
import { movementSystem } from "../rules/systems/movementSystem.js";
import { combatSystem } from "../rules/systems/combatSystem.js";
import { installAffixTriggers } from "../rules/systems/affixTriggerSystem.js";
import { cleanupSystem } from "../rules/systems/cleanupSystem.js";
import { trapSystem } from "../rules/systems/trapSystem.js";
import { manaRegenerationSystem } from "../rules/systems/manaRegenerationSystem.js";
import { monsterSpawnerSystem } from "../rules/systems/monsterSpawnerSystem.js";
import { spatialIndexSystem } from "../rules/systems/spatialIndexSystem.js";
import { deitySystem } from "../rules/systems/deitySystem.js";
import { engraveSystem, installEngraveListeners } from "../rules/systems/engraveSystem.js";
import { hungerSystem } from "../rules/systems/hungerSystem.js";
// Side-effect: registers script handlers at import time
import "../rules/scripts/traps.js";
import "../rules/scripts/monsters.js";
import "../rules/scripts/consumables.js";

/**
 * @param {World} world
 */
export function configureWorld(world) {
  clearSystems();

  // Install affix event listeners once per world
  installAffixTriggers(world);
  // Install engraving scramble-on-step listener once per world
  installEngraveListeners(world);

  // Phase: intents (consume queued intents)
  // Producers first (AI), then consumers (movement, interactions, etc.)
  registerSystem(aiChaseSystem, 'intents');
  registerSystem(petFollowSystem, 'intents');
  registerSystem(waitSystem, 'intents');
  registerSystem(drinkSystem, 'intents');
  registerSystem(useItemSystem, 'intents');
  registerSystem(equipItemSystem, 'intents');
  registerSystem(itemDropSystem, 'intents');
  registerSystem(rangedAttackSystem, 'intents');
  registerSystem(castSpellSystem, 'intents');
  registerSystem(engraveSystem, 'intents');
  registerSystem(movementSystem, 'intents');
  // interactionSystem must run AFTER movementSystem: bump-to-interact adds
  // InteractIntent during movement; processing it in the same tick prevents
  // the shop overlay from re-firing on every subsequent action.
  registerSystem(interactionSystem, 'intents');
  registerSystem(combatSystem, 'intents');
  // Run pickup after movement so stepping onto items can pick them up immediately
  registerSystem(itemPickupSystem, 'intents');
  // Traps trigger after movement (player steps onto trap tile)
  registerSystem(trapSystem, 'intents');

  // Phase: effects (derived first, then per-turn effects)
  registerSystem(equipmentSystem, 'effects');
  registerSystem(effectSystem, 'effects');
  registerSystem(hungerSystem, 'effects');
  registerSystem(manaRegenerationSystem, 'effects');
  // Post-move auto-pickup runs after intents, within the same tick
  registerSystem(autoPickupPostMoveSystem, 'effects');
  // Spawners tick in the effects phase
  registerSystem(monsterSpawnerSystem, 'effects');
  // Deity mood ticks in the effects phase (after combat results are emitted)
  registerSystem(deitySystem, 'effects');

  // Phase: cleanup (end-of-turn removals like killing entities with hp <= 0)
  registerSystem(cleanupSystem, 'cleanup');
  // Keep spatial index in sync after structural changes
  registerSystem(spatialIndexSystem, 'cleanup');

  // Compose scheduler: order of phases matters
  const baseScheduler = composeScheduler('intents', 'effects', 'cleanup');
  const profEnabled = shouldProfileRules();
  if (!profEnabled) {
    world.setScheduler(baseScheduler);
    return;
  }

  // Build profiled scheduler: measure per system and per phase using high-res timer
  /** @type {Array<'intents'|'effects'|'cleanup'>} */
  const phases = ['intents', 'effects', 'cleanup'];
  /** @type {Record<string, Function[]>} */
  const phaseSystems = Object.create(null);
  for (const ph of phases) phaseSystems[ph] = getOrderedSystems(ph);

  world.setScheduler((w, dt) => {
    const perf = getRulesProfilerState();
    /** @type {any} */
    const tick = { phases: {}, totalMs: 0 };
    let tickStart = performance.now();

    for (const ph of phases) {
      /** @type {Function[]} */
      const list = phaseSystems[ph] || [];
      let phStart = performance.now();
      const sysTimes = [];
      for (let i = 0; i < list.length; i++) {
        /** @type {Function} */
        const fn = /** @type any */ (list[i] || (()=>{}));
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
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search || '');
  const v = (params.get('rulesProfile') || (typeof localStorage !== 'undefined' ? localStorage.getItem('jshack.rulesProfile') : '0') || '0');
  return v === '1' || v === 'true' || v === 'on';
}

function getRulesProfilerState() {
  const w = /** @type any */(window);
  return (w.__JSHACK_RULES_PROF ||= { enabled: true, lastTick: null });
}
