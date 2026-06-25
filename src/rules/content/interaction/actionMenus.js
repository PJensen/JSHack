// src/rules/content/interaction/actionMenus.js
//
// Legacy registry of multi-action interactables.
//
// When the player interacts with an entity whose Interactable.action key
// appears here AND no intent.mode is set, the interact runner emits an
// InteractionChoicePrompted event instead of running a payload.
//
// New authored definitions keep their actions beside their hooks through
// defineInteractable(). This object remains only until legacy actions migrate.
//
// Single-action interactables (doors, wells, signs, etc.) need no entry here —
// they bypass the menu and dispatch directly.

export const ACTION_MENUS = {};

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
