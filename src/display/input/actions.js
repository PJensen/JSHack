// display/input/actions.js
// Normalized input actions and sink mapping (display-only; no rules imports)

export const Sinks = Object.freeze({
  rules: "rules",
  display: "display",
});

// Canonical action names; payload shape documented per action
export const Actions = Object.freeze({
  // Rules-directed intents
  Move: "rules.move", // payload: { dx:number, dy:number }
  Wait: "rules.wait", // payload: {}
  DrinkPotion: "rules.drinkPotion", // payload: { itemId?:number, targetId?:number }
  CastActiveSpell: "rules.castActiveSpell", // payload: { spellId?:number, targetId?:number }
  EquipItem: "rules.equipItem", // payload: { itemId:number }
  ShootRanged: "rules.shootRanged", // payload: {}

  // Display-directed UI
  OpenInventory: "display.openInventory", // payload: {}
  OpenMessageLog: "display.openMessageLog", // payload: {}
  Zoom: "display.zoom", // payload: { factor:number } (pinch scale delta)
  // Open a chooser for items underfoot; display will query and let user pick
  OpenPickupChooser: "display.openPickupChooser", // payload: {}
  // Direct rules pickup (used by chooser submission)
  PickupItem: "rules.pickupItem", // payload: { itemId?:number, count?:number }
});

// Default routing from action → sink
export const defaultActionSinks = Object.freeze({
  // Rules-directed intents
  [Actions.Move]: Sinks.rules,
  [Actions.Wait]: Sinks.rules,
  [Actions.DrinkPotion]: Sinks.rules,
  [Actions.PickupItem]: Sinks.rules,
  [Actions.CastActiveSpell]: Sinks.rules,
  [Actions.EquipItem]: Sinks.rules,
  [Actions.ShootRanged]: Sinks.rules,

  // Display-directed UI actions
  [Actions.OpenInventory]: Sinks.display,
  [Actions.OpenMessageLog]: Sinks.display,
  [Actions.Zoom]: Sinks.display,
  [Actions.OpenPickupChooser]: Sinks.display,
});

// Utility to build an action object
export function makeAction(type, payload = {}) {
  return { type, payload };
}
