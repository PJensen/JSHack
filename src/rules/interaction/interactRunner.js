// src/rules/interaction/interactRunner.js
//
// Lightweight hook runner for interactable entities.
// Mirrors the usePipeline/before+on+after pattern from the items system.
//
// Context exposed to every hook:
//   ctx.world      — full world (needed for complex ops like createFrom, dealDamage)
//   ctx.actor      — entity ID of the acting entity
//   ctx.targetId   — entity ID of the interactable target
//   ctx.params     — Interactable.params (static data on the archetype)
//   ctx.intent     — the InteractIntent data (mode, recipe, itemId, …)
//   ctx.cancelled  — boolean, set by ctx.cancel()
//   ctx.cancelReason — { code, message } or null
//   ctx.cancel(code, message) — abort remaining hook phases
//   ctx.emit(event, data) — convenience alias for world.emit
//   ctx.data       — mutable bag for sharing state between hook phases

import { INTERACT_PAYLOADS } from "../content/interaction/interactPayloads.js";
import { ACTION_MENUS } from "../content/interaction/actionMenus.js";

/**
 * @param {any} world
 * @param {number} actor
 * @param {number} targetId
 * @param {any|null} params
 * @param {any|null} intent
 * @returns {{ cancelled: boolean, cancelReason: any, data: any }}
 */
export function createInteractContext(world, actor, targetId, params, intent) {
  const ctx = {
    world,
    actor,
    targetId,
    params,
    intent,
    data: {},
    cancelled: false,
    cancelReason: null,
    /** @param {string} code @param {string} [message] */
    cancel(code, message = "") {
      this.cancelled = true;
      this.cancelReason = { code: String(code), message: String(message) };
    },
    /** @param {string} event @param {any} data */
    emit(event, data) {
      this.world.emit?.(event, data);
    },
  };
  return ctx;
}

/**
 * Look up and run all hooks for an action.
 * Returns true if a payload was found, false if the action is unregistered.
 *
 * @param {string} action
 * @param {any} world
 * @param {number} actor
 * @param {number} targetId
 * @param {any|null} params
 * @param {any|null} intent
 * @returns {boolean}
 */
export function runInteractHooks(action, world, actor, targetId, params, intent) {
  // If the action has a multi-option menu and no mode was chosen yet,
  // emit the chooser event and bail — the UI will re-dispatch with a mode.
  const menu = ACTION_MENUS[action];
  if (menu && !intent?.mode) {
    world.emit?.("action:choose", { actor, targetId, action, options: menu });
    return true;
  }

  const payload = INTERACT_PAYLOADS[action];
  if (!payload) return false;

  const ctx = createInteractContext(world, actor, targetId, params, intent);

  if (typeof payload.beforeInteract === "function") {
    payload.beforeInteract(ctx);
    if (ctx.cancelled) return true;
  }

  if (typeof payload.onInteract === "function") {
    payload.onInteract(ctx);
  }

  if (!ctx.cancelled && typeof payload.afterInteract === "function") {
    payload.afterInteract(ctx);
  }

  return true;
}
