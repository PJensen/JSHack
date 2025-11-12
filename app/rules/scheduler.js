// app/rules/scheduler.js
// Register rules systems into phases and set the world scheduler.

import { composeScheduler, registerSystem, clearSystems, getOrderedSystems } from "../../src/lib/ecs-js/index.js";
/** @typedef {import('../../src/lib/ecs-js').World} World */
import { drinkSystem } from "../../src/rules/systems/drinkSystem.js";
import { itemPickupSystem, autoPickupPostMoveSystem } from "../../src/rules/systems/itemPickupSystem.js";
import { itemDropSystem } from "../../src/rules/systems/itemDropSystem.js";
import { equipItemSystem } from "../../src/rules/systems/equipItemSystem.js";
import { useItemSystem } from "../../src/rules/systems/useItemSystem.js";
import { projectileSystem } from "../../src/rules/systems/projectileSystem.js";
import { interactionSystem } from "../../src/rules/systems/interactionSystem.js";
import { effectSystem } from "../../src/rules/systems/effectSystem.js";
import { monsterSpawnerSystem } from "../../src/rules/systems/monsterSpawnerSystem.js";
import { equipmentSystem } from "../../src/rules/systems/equipmentSystem.js";
import { waitSystem } from "../../src/rules/systems/waitSystem.js";
import { castSpellSystem } from "../../src/rules/systems/castSpellSystem.js";
import { rangedAttackSystem } from "../../src/rules/systems/rangedAttackSystem.js";
import { faceSystem } from "../../src/rules/systems/faceSystem.js";
import { aiChaseSystem } from "../../src/rules/systems/aiChaseSystem.js";
import { movementSystem } from "../../src/rules/systems/movementSystem.js";
import { combatSystem } from "../../src/rules/systems/combatSystem.js";
import { installAffixTriggers } from "../../src/rules/systems/affixTriggerSystem.js";
import { cleanupSystem } from "../../src/rules/systems/cleanupSystem.js";
import { trapSystem } from "../../src/rules/systems/trapSystem.js";
// Register trap scripts
import "../../src/rules/scripts/traps.js";
import {
  FloorRef,
  Position,
  Facing,
  GeomHandle,
  FloorState,
  LightingAccelHandle,
  DungeonLevel,
  PortalTrace,
  LightSource
} from "../../src/rules/components/index.js";
import { KernelCache, getPortalsV } from "../../src/rules/analytic/index.js";
import { createGeomKernelSystem } from "../../src/rules/systems/geomKernelSystem.js";
import { createKernelPrewarmSystem } from "../../src/rules/systems/kernelPrewarmSystem.js";
import { createPortalUseSystem } from "../../src/rules/systems/portalUseSystem.js";
import { createLightingBakeSystem } from "../../src/rules/systems/lightingBakeSystem.js";
import { createFloorActivationSystem } from "../../src/rules/systems/floorActivationSystem.js";

/**
 * @param {World} world
 */
export function configureWorld(world) {
  clearSystems();

  // Install affix event listeners once per world
  installAffixTriggers(world);

  const kernelCache = new KernelCache(4);

  registerSystem(
    createGeomKernelSystem({
      geomHandleComponent: GeomHandle,
      floorStateComponent: FloorState
    }),
    "intents"
  );

  registerSystem(
    createKernelPrewarmSystem({
      floorRefComponent: FloorRef,
      positionComponent: Position,
      cache: kernelCache,
      portalsAccessor: getPortalsV
    }),
    "intents"
  );

  // Phase: intents (consume queued intents)
  // Producers first (AI), then consumers (movement, interactions, etc.)
  registerSystem(aiChaseSystem, 'intents');
  registerSystem(waitSystem, 'intents');
  registerSystem(drinkSystem, 'intents');
  registerSystem(useItemSystem, 'intents');
  registerSystem(equipItemSystem, 'intents');
  registerSystem(itemDropSystem, 'intents');
  registerSystem(projectileSystem, 'intents');
  registerSystem(interactionSystem, 'intents');
  registerSystem(castSpellSystem, 'intents');
  registerSystem(faceSystem, 'intents');
  registerSystem(rangedAttackSystem, 'intents');
  registerSystem(movementSystem, 'intents');
  registerSystem(combatSystem, 'intents');
  // Run pickup after movement so stepping onto items can pick them up immediately
  registerSystem(itemPickupSystem, 'intents');

  // Phase: effects (derived first, then per-turn effects)
  registerSystem(equipmentSystem, 'effects');
  registerSystem(effectSystem, 'effects');
  registerSystem(monsterSpawnerSystem, 'effects');
  // Trigger traps after movement and core effects
  registerSystem(trapSystem, 'effects');
  // Post-move auto-pickup runs after intents, within the same tick
  registerSystem(autoPickupPostMoveSystem, 'effects');

  registerSystem(
    createPortalUseSystem({
      floorRefComponent: FloorRef,
      positionComponent: Position,
      facingComponent: Facing,
      portalTraceComponent: PortalTrace,
      portalsAccessor: getPortalsV
    }),
    'effects'
  );

  registerSystem(
    createLightingBakeSystem({
      lightingAccelComponent: LightingAccelHandle,
      geomHandleComponent: GeomHandle,
      lightProvider: (floorId) => {
        const lights = [];
        for (const [id, light, pos, ref] of world.query(LightSource, Position, FloorRef)) {
          if (!ref || ref.floorId !== floorId) continue;
          lights.push({
            id,
            position: { x: pos.x, y: pos.y },
            intensity: light.intensity ?? 1,
            radius: light.radius ?? 0,
            color: light.color ?? '#ffffff'
          });
        }
        return lights;
      }
    }),
    'effects'
  );

  registerSystem(
    createFloorActivationSystem({ dungeonLevelComponent: DungeonLevel }),
    'effects'
  );

  // Phase: cleanup (end-of-turn removals like killing entities with hp <= 0)
  registerSystem(cleanupSystem, 'cleanup');

  // Compose scheduler: order of phases matters
  const baseScheduler = composeScheduler('intents', 'effects', 'cleanup');
  const profEnabled = shouldProfileRules();
  if (!profEnabled) {
    world.setScheduler(baseScheduler);
    return;
  }

  // Build profiled scheduler: measure per system and per phase using high-res timer
  /** @type {Array<'intents'|'effects'>} */
  const phases = ['intents', 'effects'];
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
  return false;
}

function getRulesProfilerState() {
  const w = /** @type any */(window);
  return (w.__JSHACK_RULES_PROF ||= { enabled: true, lastTick: null });
}
