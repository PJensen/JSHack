// src/main/scheduler.js
// Register rules systems into phases and set the world scheduler.

import { composeScheduler, registerSystem, clearSystems, getOrderedSystems, installScriptsAPI } from "../lib/ecs-js/index.js";
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
import { shieldGuardSystem } from "../rules/systems/shieldGuardSystem.js";
import { stealthAmbushSystem } from "../rules/systems/stealthAmbushSystem.js";
import { waitSystem } from "../rules/systems/waitSystem.js";
import { searchSystem } from "../rules/systems/searchSystem.js";
import { postureIntentSystem } from "../rules/systems/postureIntentSystem.js";
import { flyIntentSystem } from "../rules/systems/flyIntentSystem.js";
import { praySystem } from "../rules/systems/praySystem.js";
import { castSpellSystem } from "../rules/systems/castSpellSystem.js";
import { aiChaseSystem, installAggroFromDamageListener, installAggroFromStealthOffenseListener } from "../rules/systems/aiChaseSystem.js";
import { aiTownfolkSystem, installTownfolkDoorListener, installBellListener } from "../rules/systems/aiTownfolkSystem.js";
import { aiScurrySystem } from "../rules/systems/aiScurrySystem.js";
import { aiFarmAnimalSystem } from "../rules/systems/aiFarmAnimalSystem.js";
import { aiWeaponPickupSystem } from "../rules/systems/aiWeaponPickupSystem.js";
import { aiCorpseEatSystem } from "../rules/systems/aiCorpseEatSystem.js";
import { aiFlyingSystem } from "../rules/systems/aiFlyingSystem.js";
import { lifespanSystem } from "../rules/systems/lifespanSystem.js";
import { knockbackSystem } from "../rules/systems/knockbackSystem.js";
import { soundPropagationSystem } from "../rules/systems/soundPropagationSystem.js";
import { encumbranceSystem } from "../rules/systems/encumbranceSystem.js";
import { weightDerivationSystem } from "../rules/systems/weightDerivationSystem.js";
import { installTauntListener, tauntSteeringSystem } from "../rules/systems/tauntSystem.js";
import { petCommandSystem } from "../rules/systems/petCommandSystem.js";
import { petBehaviorSystem } from "../rules/systems/petBehaviorSystem.js";
import { summonedBehaviorSystem } from "../rules/systems/summonedBehaviorSystem.js";
import { shopkeeperSystem } from "../rules/systems/shopkeeperSystem.js";
import { movementSystem, installMoveAutoPickupListener } from "../rules/systems/movementSystem.js";
import { intentValidationSystem } from "../rules/systems/intentValidationSystem.js";
import { combatSystem, installBumpAttackListener } from "../rules/systems/combatSystem.js";
import { installCombatInteractions } from "../rules/data/combatInteractions.js";
import { cleanupSystem, installDeathImpactTracker } from "../rules/systems/cleanupSystem.js";
import { trapSystem } from "../rules/systems/trapSystem.js";
import { disarmTrapSystem } from "../rules/systems/disarmTrapSystem.js";
import { manaRegenerationSystem } from "../rules/systems/manaRegenerationSystem.js";
import { staminaRegenerationSystem } from "../rules/systems/staminaRegenerationSystem.js";
import { monsterSpawnerSystem } from "../rules/systems/monsterSpawnerSystem.js";
import { spatialIndexSystem } from "../rules/systems/spatialIndexSystem.js";
import { deitySystem } from "../rules/systems/deitySystem.js";
import { engraveSystem, installEngraveListeners } from "../rules/systems/engraveSystem.js";
import { installBumpInteractListener } from "../rules/systems/interactionSystem.js";
import { hungerSystem } from "../rules/systems/hungerSystem.js";
import { shopAmbientSoundSystem } from "../rules/systems/shopAmbientSoundSystem.js";
import { hazardSystem } from "../rules/systems/hazardSystem.js";
import { installMonsterDeathHooks } from "../rules/systems/monsterDeathHookSystem.js";
import { installScoreListener } from "../rules/systems/scoreSystem.js";
import { installMaterialReactionListeners, materialReactionSystem } from "../rules/systems/materialReactionSystem.js";
import { foodDecaySystem } from "../rules/systems/foodDecaySystem.js";
import { itemCooldownSystem } from "../rules/systems/itemCooldownSystem.js";
import { spellCooldownSystem } from "../rules/systems/spellCooldownSystem.js";
import { harvestRegrowthSystem } from "../rules/systems/harvestRegrowthSystem.js";
import { plantGrowthSystem } from "../rules/systems/plantGrowthSystem.js";
import { fountainRegrowthSystem } from "../rules/systems/fountainRegrowthSystem.js";
import { overworldAmbientSystem } from "../rules/systems/overworldAmbientSystem.js";
import { weatherSystem } from "../rules/systems/weatherSystem.js";
import { calendarSystem } from "../rules/systems/calendarSystem.js";
import { townSimulationSystem } from "../rules/systems/townSimulationSystem.js";
import { entrancePressureSystem } from "../rules/systems/entrancePressureSystem.js";
import { districtConditionSystem } from "../rules/systems/districtConditionSystem.js";
import { installTileStepEffectListener } from "../rules/systems/tileStepEffectSystem.js";
import { installPolymorphListener } from "../rules/systems/polymorphSystem.js";
import { installCurseHooks } from "../rules/systems/curseHooks.js";
import { channelingSystem, installDrainLifeDamageInterruptListener } from "../rules/systems/channelingSystem.js";
import { installGenocideListener } from "../rules/systems/genocideSystem.js";
import { installTamingListener } from "../rules/systems/tamingSystem.js";
import { workstationStateSystem } from "../rules/systems/workstationStateSystem.js";
import { defineInventoryVirtuals, installVirtuals } from "../rules/utils/inventoryVirtuals.js";
import { defineDerivedStatVirtuals } from "../rules/utils/derivedStats.js";
import { definePassiveBonusVirtuals } from "../rules/utils/passiveBonuses.js";
import { defineTownInterpretationVirtuals } from "../rules/utils/townInterpretationVirtuals.js";
import { installDialogRuntime } from "../rules/dialogues/runtime.js";
import { installQuestRuntime } from "../rules/quests/runtime.js";
import { installStarterFetchQuestHooks } from "../rules/quests/definitions/graveyardWatch.js";
import { installRatQuestHooks } from "../rules/quests/definitions/ratInfestation.js";
// Side-effect: registers script handlers at import time
import "../rules/scripts/traps.js";
import "../rules/scripts/monsters.js";
import "../rules/data/procPackages.js";
import "../rules/dialogues/townfolkDialogs.js";
import { installGemSocketListener } from "../rules/data/gemSocketAffixes.js";
import { installElectrocuteOnDamage } from "../rules/utils/electrocute.js";
import { installCentipedeBodyCascade } from "../rules/utils/centipedeMovement.js";
import { installPerceptionMemoryListeners, perceptionMemorySystem } from "../rules/systems/perceptionMemorySystem.js";

/**
 * @param {World} world
 */
export function configureWorld(world) {
  clearSystems();
  installScriptsAPI(world);
  installVirtuals(world);
  defineInventoryVirtuals(world);
  defineDerivedStatVirtuals(world);
  definePassiveBonusVirtuals(world);
  defineTownInterpretationVirtuals(world);
  installDialogRuntime(world);
  installQuestRuntime(world);
  installStarterFetchQuestHooks(world);
  installRatQuestHooks(world);

  installTownfolkDoorListener(world);
  installBellListener(world);
  installGemSocketListener(world);
  // Install engraving scramble-on-step listener once per world
  installEngraveListeners(world);
  // Install bump-interact listener for immediate interactions (doors, chests, NPCs)
  installBumpInteractListener(world);
  // Install bump-attack listener for immediate melee-on-bump resolution
  installBumpAttackListener(world);
  // Install data-driven combat interaction rules (blessed vs undead, frozen shatter, etc.)
  installCombatInteractions(world);
  // Install monster death hooks once per world
  installMonsterDeathHooks(world);
  // Track killing-blow impact vectors so loot scatter is directional
  installDeathImpactTracker(world);
  // Install taunt listeners once per world
  installTauntListener(world);
  // Award monster maxHp to player score on kill
  installScoreListener(world);
  // Auto-pickup currency etc. when any actor moves onto a tile (reacts to "moved" event)
  installMoveAutoPickupListener(world);
  // Tile step effects: ice slides, lava scorch, water extinguish (reacts to "moved" event)
  installTileStepEffectListener(world);
  // Material reactions consume semantic reaction events (water splash/dip, etc.).
  installMaterialReactionListeners(world);
  // Polymorph requests (e.g. mimic reveal on touch).
  installPolymorphListener(world);
  installCurseHooks(world);
  installGenocideListener(world);
  installTamingListener(world);
  // Elevate enemy AggroState when they take damage (even off-screen).
  installAggroFromDamageListener(world);
  // Witnesses react to stealth offense and enter hunting with attacker last-known position.
  installAggroFromStealthOffenseListener(world);
  // Auto-apply electrocution (stun + blind + deafen) on any electric/lightning damage.
  installElectrocuteOnDamage(world);
  // Drain Life is uniquely interrupted by incoming damage.
  installDrainLifeDamageInterruptListener(world);
  // Centipede body segments cascade position when the head moves.
  installCentipedeBodyCascade(world);
  installPerceptionMemoryListeners(world);

  // Phase: ai (intent producers — added intents are visible to later phases
  // in the same tick because ecs-js add() is intratick-immediate)
  registerSystem(intentValidationSystem, 'ai');
  // Flying AI claims the action with FlyIntent before scurry/chase.
  registerSystem(aiFlyingSystem, 'ai');
  // Scurry before chase: dumb idle creatures set a random MoveIntent which
  // aiChaseSystem's existing intent-skip guard then honours.
  registerSystem(aiScurrySystem, 'ai');
  registerSystem(aiFarmAnimalSystem, 'ai');
  registerSystem(aiTownfolkSystem, 'ai');
  registerSystem(aiChaseSystem, 'ai');
  // Weapon pickup after chase so the monster's hunt state is settled first.
  registerSystem(aiWeaponPickupSystem, 'ai');
  // Corpse eating after weapon pickup — idle scavengers and tactical devourers.
  registerSystem(aiCorpseEatSystem, 'ai');
  registerSystem(summonedBehaviorSystem, 'ai');
  registerSystem(petCommandSystem, 'ai');
  registerSystem(petBehaviorSystem, 'ai');

  // Phase: intents (intent consumers + steering)
  // Knockback resolves before standard movement so positions are committed first.
  registerSystem(knockbackSystem, 'intents', { before: [movementSystem] });
  registerSystem(flyIntentSystem, 'intents');
  registerSystem(waitSystem, 'intents');
  registerSystem(searchSystem, 'intents');
  registerSystem(postureIntentSystem, 'intents');
  registerSystem(praySystem, 'intents');
  registerSystem(drinkSystem, 'intents');
  registerSystem(useItemSystem, 'intents');
  registerSystem(applySystem, 'intents');
  registerSystem(equipItemSystem, 'intents');
  registerSystem(itemDropSystem, 'intents');
  registerSystem(engraveSystem, 'intents');
  // Shopkeeper system must run BEFORE movementSystem to block exits
  registerSystem(shopkeeperSystem, 'intents');
  // Taunt steering can override enemy movement intents before movement resolves.
  registerSystem(tauntSteeringSystem, 'intents');
  // Refill dry fountains at cooldown before interaction tries to drink.
  registerSystem(fountainRegrowthSystem, 'intents');
  // Resolve movement before targeted ranged actions so same-tick attacks use
  // the destination a target actually reaches this turn.
  registerSystem(movementSystem, 'intents', {
    after: [knockbackSystem, shopkeeperSystem, tauntSteeringSystem, fountainRegrowthSystem],
    before: [throwSystem, rangedAttackSystem, channelingSystem, castSpellSystem, interactionSystem, combatSystem],
  });
  registerSystem(throwSystem, 'intents', { after: [movementSystem] });
  registerSystem(rangedAttackSystem, 'intents', { after: [movementSystem] });
  registerSystem(channelingSystem, 'intents', { after: [movementSystem] });   // countdown before castSpellSystem fires
  registerSystem(castSpellSystem, 'intents', { after: [movementSystem, channelingSystem] });
  // interactionSystem must run AFTER movementSystem: bump-to-interact adds
  // InteractIntent during movement; processing it in the same tick prevents
  // the shop overlay from re-firing on every subsequent action.
  registerSystem(interactionSystem, 'intents', { after: [movementSystem] });
  registerSystem(combatSystem, 'intents', { after: [movementSystem] });
  // Run pickup after movement so stepping onto items can pick them up immediately
  registerSystem(itemPickupSystem, 'intents');
  // Disarm attempts resolve before traps trigger (so disarming prevents stepping-trigger)
  registerSystem(disarmTrapSystem, 'intents');
  // Traps trigger after movement (player steps onto trap tile)
  registerSystem(trapSystem, 'intents');

  // Phase: effects (derived first, then per-turn effects)
  // Weight derivation: bottom-up recomputation of Weight.total for bags/actors.
  registerSystem(weightDerivationSystem, 'effects');
  // Encumbrance recomputed after equipment + weight are settled; movement reads it next tick.
  registerSystem(encumbranceSystem, 'effects');
  // Sound propagation checks SoundEmitter vs Anatomy.hearing; updates AggroState.
  registerSystem(soundPropagationSystem, 'effects');
  // Run stealth ambush rearm before effect aging so the cooldown tracker can
  // complete cleanly and restore opener while invisibility remains active.
  registerSystem(stealthAmbushSystem, 'effects');
  registerSystem(effectSystem, 'effects');
  // Keep shield guard/break icon state synced to equipped offhand shields.
  registerSystem(shieldGuardSystem, 'effects');
  registerSystem(materialReactionSystem, 'effects');
  registerSystem(hungerSystem, 'effects');
  // Food decay ticks after hunger (rot inventory food each turn)
  registerSystem(foodDecaySystem, 'effects');
  registerSystem(itemCooldownSystem, 'effects');
  registerSystem(spellCooldownSystem, 'effects');
  registerSystem(hazardSystem, 'effects');
  registerSystem(manaRegenerationSystem, 'effects');
  registerSystem(staminaRegenerationSystem, 'effects');
  registerSystem(harvestRegrowthSystem, 'effects');
  registerSystem(plantGrowthSystem, 'effects');
  registerSystem(calendarSystem, 'effects');
  registerSystem(weatherSystem, 'effects');
  registerSystem(townSimulationSystem, 'effects');
  registerSystem(entrancePressureSystem, 'effects');
  registerSystem(districtConditionSystem, 'effects');
  registerSystem(overworldAmbientSystem, 'effects');
  registerSystem(workstationStateSystem, 'effects');
  // Post-move auto-pickup runs after intents, within the same tick
  registerSystem(autoPickupPostMoveSystem, 'effects');
  // Spawners tick in the effects phase
  registerSystem(monsterSpawnerSystem, 'effects');
  // Deity mood ticks in the effects phase (after combat results are emitted)
  registerSystem(deitySystem, 'effects');
  // Shop ambient sound cues resolve in effects.
  registerSystem(shopAmbientSoundSystem, 'effects');
  registerSystem(perceptionMemorySystem, 'effects');

  // Phase: cleanup (end-of-turn removals like killing entities with hp <= 0)
  registerSystem(cleanupSystem, 'cleanup');
  // Lifespan countdown and entity removal (before spatial index sync).
  registerSystem(lifespanSystem, 'cleanup');
  // Keep spatial index in sync after structural changes
  registerSystem(spatialIndexSystem, 'cleanup');

  const baseScheduler = composeScheduler('ai', 'intents', 'effects', 'scripts', 'cleanup');
  const profEnabled = shouldProfileRules();
  if (!profEnabled) {
    world.setScheduler(baseScheduler);
    return;
  }

  // Build profiled scheduler: measure per system and per phase using high-res timer
  /** @type {Array<'ai'|'intents'|'effects'|'scripts'|'cleanup'>} */
  const phases = ['ai', 'intents', 'effects', 'scripts', 'cleanup'];
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
