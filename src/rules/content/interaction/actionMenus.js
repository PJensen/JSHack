// src/rules/content/interaction/actionMenus.js
//
// Data-driven registry of multi-action interactables.
//
// When the player interacts with an entity whose Interactable.action key
// appears here AND no intent.mode is set, the interact runner emits an
// "action:choose" event with these options instead of running a payload.
//
// To add a new multi-action interactable:
//   1. Add an entry here keyed by the Interactable.action string.
//   2. Each option needs { mode, label }.
//   3. Handle each mode inside the payload's onInteract (check ctx.intent.mode).
//
import { Interactable } from "../../components/Interactable.js";

// Single-action interactables (doors, wells, signs, etc.) need no entry here —
// they bypass the menu and dispatch directly.

const FOUNTAIN_ACTIONS = Object.freeze([
  { mode: "drink", label: "Drink" },
  { mode: "dip", label: "Dip" },
]);

export const ACTION_MENUS = {
  fountain(world, targetId) {
    const inter = world?.get?.(targetId, Interactable);
    const params = (inter?.params && typeof inter.params === "object")
      ? inter.params
      : null;
    const charges = Number(params?.chargesRemaining);
    if (Number.isFinite(charges) && charges <= 0) return [];
    return FOUNTAIN_ACTIONS;
  },
};

/**
 * @param {string} action
 * @param {any} world
 * @param {number} targetId
 * @returns {Array<{mode:string,label:string}>|null}
 */
export function resolveActionMenu(action, world, targetId) {
  const entry = ACTION_MENUS[action];
  if (!entry) return null;
  return typeof entry === "function" ? entry(world, targetId) : entry;
}
