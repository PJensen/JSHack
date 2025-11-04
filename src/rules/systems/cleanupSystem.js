// src/rules/systems/cleanupSystem.js
// Removes entities that have zero (or below) Vitality at the end of the current turn.
// Gameplay rationale: doing cleanup at the end of the turn prevents "dead men walking"
// in subsequent ticks while still allowing all systems in the current turn to react
// to the death (events, affixes, VFX, logging). In-engine, destroy() during a tick
// is deferred to the tick flush, so this acts as end-of-turn removal.

import { Vitality } from "../components/Vitality.js";

/**
 * Collect all entities with Vitality and remove those whose hp <= 0.
 * Keep this system small and deterministic; drops/epitaphs/etc. can be layered later.
 * @param {import('../../lib/ecs-js').World} world
 */
export function cleanupSystem(world) {
  for (const [id, vit] of world.query(Vitality)) {
    if (!vit) continue;
    if ((vit.hp | 0) <= 0 && world.isAlive(id)) {
      world.destroy(id);
    }
  }
}
