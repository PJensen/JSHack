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
// Single-action interactables (doors, wells, signs, etc.) need no entry here —
// they bypass the menu and dispatch directly.

export const ACTION_MENUS = {
  fountain: [
    { mode: "drink", label: "Drink" },
    { mode: "dip",   label: "Dip" },
  ],
};
