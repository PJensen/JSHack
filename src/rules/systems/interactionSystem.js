// src/rules/systems/interactionSystem.js
//
// Thin dispatch layer. All interaction logic lives in:
//   src/content/interactables/                         (authored definitions)
//   src/rules/content/interaction/interactPayloads.js  (legacy definitions)
//   src/rules/interaction/interactRunner.js             (context + hook runner)
//
// To add a new interactable: author it with defineInteractable().
// This file never needs to change.

import { Interactable } from "../components/Interactable.js";
import { InteractIntent } from "../components/Intents/InteractIntent.js";
import { runInteractHooks } from "../interaction/interactRunner.js";
import { isEntityOnCurrentFloor } from "../utils/floorEntities.js";

/**
 * Dispatch a single interaction between actor and targetId.
 * Returns true if a hook payload was found and executed, false otherwise.
 *
 * @param {any} world
 * @param {number} actor
 * @param {number} targetId
 * @param {any|null} intent
 * @returns {boolean}
 */
export function InteractionSystem(world, actor, targetId, intent = null) {
  if (!isEntityOnCurrentFloor(world, targetId, { fallbackWhenNoDungeonState: true })) return false;
  const inter = world.get(targetId, Interactable);
  if (!inter) return false;
  return runInteractHooks(inter.action, world, actor, targetId, inter.params, intent);
}

/**
 * Per-tick system: drains the InteractIntent queue and dispatches each one.
 *
 * @param {any} world
 */
export function interactionSystem(world) {
  for (const [actor, intent] of world.query(InteractIntent)) {
    try {
      InteractionSystem(world, actor, intent.targetId || 0, intent);
    } catch (e) {
      console.error("[interactionSystem] dispatch failed:", e);
    }
    try { world.remove(actor, InteractIntent); } catch {}
  }
}

// ─── Bump-interact event listener ────────────────────────────────────────────

const BUMP_INTERACT_INSTALLED = Symbol.for("jshack.bumpInteract");

/**
 * Install a one-time bump:interact listener for movement-triggered interactions
 * (e.g. walking into a door). This bypasses the intent queue so bump actions
 * resolve immediately during movement.
 *
 * @param {any} world
 */
export function installBumpInteractListener(world) {
  if (!world || world[BUMP_INTERACT_INSTALLED]) return;
  world[BUMP_INTERACT_INSTALLED] = true;
  world.on("bump:interact", /** @param {{actor:number,target:number}} ev */ (ev) => {
    try {
      InteractionSystem(world, ev.actor, ev.target);
    } catch (e) {
      console.error("[interactionSystem] bump dispatch failed:", e);
    }
  });
}
