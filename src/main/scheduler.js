// src/main/scheduler.js
// Register rules systems into phases and set the world scheduler.

import { composeScheduler, registerSystem, clearSystems, getOrderedSystems } from "../lib/ecs-js/index.js";
/** @typedef {import('../lib/ecs-js/index.js').World} World */
import { drinkSystem } from "../rules/systems/drinkSystem.js";
import { itemPickupSystem, autoPickupPostMoveSystem } from "../rules/systems/itemPickupSystem.js";
import { itemDropSystem } from "../rules/systems/itemDropSystem.js";
import { equipItemSystem } from "../rules/systems/equipItemSystem.js";
import { useItemSystem } from "../rules/systems/useItemSystem.js";
import { applySystem } from "../rules/systems/applySystem.js";
import { throwSystem } from "../rules/systems/throwSystem.js";
import { rangedAttackSystem } from "../rules/systems/rangedAttackSystem.js";
import { interactionSystem } from "../rules/systems/interactionSystem.js";
import { effectSystem } from "../rules/systems/effectSystem.js";
import { equipmentSystem } from "../rules/systems/equipmentSystem.js";
import { waitSystem } from "../rules/systems/waitSystem.js";
import { praySystem } from "../rules/systems/praySystem.js";
import { castSpellSystem } from "../rules/systems/castSpellSystem.js";
import { aiChaseSystem } from "../rules/systems/aiChaseSystem.js";
import { installTauntListener, tauntSteeringSystem } from "../rules/systems/tauntSystem.js";
import { petCommandSystem } from "../rules/systems/petCommandSystem.js";
import { petBehaviorSystem } from "../rules/systems/petBehaviorSystem.js";
import { shopkeeperSystem } from "../rules/systems/shopkeeperSystem.js";
import { movementSystem } from "../rules/systems/movementSystem.js";
import { combatSystem, installBumpAttackListener } from "../rules/systems/combatSystem.js";
import { installAffixTriggers } from "../rules/systems/affixTriggerSystem.js";
import { cleanupSystem } from "../rules/systems/cleanupSystem.js";
import { trapSystem } from "../rules/systems/trapSystem.js";
import { manaRegenerationSystem } from "../rules/systems/manaRegenerationSystem.js";
import { staminaRegenerationSystem } from "../rules/systems/staminaRegenerationSystem.js";
import { monsterSpawnerSystem } from "../rules/systems/monsterSpawnerSystem.js";
import { spatialIndexSystem } from "../rules/systems/spatialIndexSystem.js";
import { deitySystem } from "../rules/systems/deitySystem.js";
import { engraveSystem, installEngraveListeners } from "../rules/systems/engraveSystem.js";
import { installBumpInteractListener } from "../rules/systems/interactionSystem.js";
import { hungerSystem } from "../rules/systems/hungerSystem.js";
import { ambientSoundSystem } from "../rules/systems/ambientSoundSystem.js";
import { hazardSystem } from "../rules/systems/hazardSystem.js";
import { installMonsterDeathHooks } from "../rules/systems/monsterDeathHookSystem.js";
import { installScoreListener } from "../rules/systems/scoreSystem.js";
import { materialReactionSystem } from "../rules/systems/materialReactionSystem.js";
import { foodDecaySystem } from "../rules/systems/foodDecaySystem.js";
import { harvestRegrowthSystem } from "../rules/systems/harvestRegrowthSystem.js";
import { overworldAmbientSystem } from "../rules/systems/overworldAmbientSystem.js";
// Side-effect: registers script handlers at import time
import "../rules/scripts/traps.js";
import "../rules/scripts/monsters.js";

/**
 * @param {World} world
 */
export function configureWorld(world) {
  clearSystems();

  // Install affix event listeners once per world
  installAffixTriggers(world);
  // Install engraving scramble-on-step listener once per world
  installEngraveListeners(world);
  // Install bump-interact listener for immediate interactions (doors, chests, NPCs)
  installBumpInteractListener(world);
  // Install bump-attack listener for immediate melee-on-bump resolution
  installBumpAttackListener(world);
  // Install monster death hooks once per world
  installMonsterDeathHooks(world);
  // Install taunt listeners once per world
  installTauntListener(world);
  // Award monster maxHp to player score on kill
  installScoreListener(world);

  // Phase: intents (consume queued intents)
  // Producers first (AI), then consumers (movement, interactions, etc.)
  registerSystem(aiChaseSystem, 'intents');
  registerSystem(petCommandSystem, 'intents'); // Process pet commands first
  registerSystem(petBehaviorSystem, 'intents'); // Then execute pet behaviors
  registerSystem(waitSystem, 'intents');
  registerSystem(praySystem, 'intents');
  registerSystem(drinkSystem, 'intents');
  registerSystem(useItemSystem, 'intents');
  registerSystem(throwSystem, 'intents');
  registerSystem(applySystem, 'intents');
  registerSystem(equipItemSystem, 'intents');
  registerSystem(itemDropSystem, 'intents');
  registerSystem(rangedAttackSystem, 'intents');
  registerSystem(castSpellSystem, 'intents');
  registerSystem(engraveSystem, 'intents');
  // Shopkeeper system must run BEFORE movementSystem to block exits
  registerSystem(shopkeeperSystem, 'intents');
  // Taunt steering can override enemy movement intents before movement resolves.
  registerSystem(tauntSteeringSystem, 'intents');
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
  registerSystem(materialReactionSystem, 'effects');
  registerSystem(hungerSystem, 'effects');
  // Food decay ticks after hunger (rot inventory food each turn)
  registerSystem(foodDecaySystem, 'effects');
  registerSystem(hazardSystem, 'effects');
  registerSystem(manaRegenerationSystem, 'effects');
  registerSystem(staminaRegenerationSystem, 'effects');
  registerSystem(harvestRegrowthSystem, 'effects');
  registerSystem(overworldAmbientSystem, 'effects');
  // Post-move auto-pickup runs after intents, within the same tick
  registerSystem(autoPickupPostMoveSystem, 'effects');
  // Spawners tick in the effects phase
  registerSystem(monsterSpawnerSystem, 'effects');
  // Deity mood ticks in the effects phase (after combat results are emitted)
  registerSystem(deitySystem, 'effects');
  // Ambient sounds check proximity in the effects phase
  registerSystem(ambientSoundSystem, 'effects');

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
